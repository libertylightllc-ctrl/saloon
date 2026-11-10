/**
 * Daily cash closing and tip payouts. The server computes expected cash, locks the day on submit
 * and posts the difference on approval; the app only shows and sends.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { BusinessDate } from '@/lib/dates';
import { asJson, supabase } from '@/lib/supabase';

export type ClosingStatus = 'open' | 'draft' | 'pending_approval' | 'approved';

export interface Closing {
  id: string;
  business_date: BusinessDate;
  status: Exclude<ClosingStatus, 'open'>;
  opening_cash_minor: number | null;
  expected_cash_minor: number | null;
  counted_cash_minor: number | null;
  variance_minor: number | null;
  reason: string | null;
  denominations: Record<string, number>;
  counted_by: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  drawer_closed_confirmed: boolean;
  taken_out_minor: number;
  taken_out_to: 'bank' | 'owner' | null;
  submitted_at: string | null;
  approved_at: string | null;
  returned_reason: string | null;
  /** Cash taken out to the bank: the day it reached the bank and the slip number (record_bank_deposit). */
  banked_on: BusinessDate | null;
  bank_ref: string | null;
  updated_at: string;
}

export interface ClosingPreview {
  business_date: BusinessDate;
  is_today: boolean;
  /** Blind count: the front desk sees no expected cash, opening cash or cash list until the day's count is sent. */
  blind: boolean;
  opening_cash_minor: number | null;
  expected_cash_minor: number | null;
  /** One line per kind of cash movement that day (sale, expense, tip_payout …), signed. */
  lines: { kind: string; entries: number; amount_minor: number }[];
  tips_owed: TipOwed[];
  closing: Closing | null;
}

export interface TipOwed {
  employee_id: string;
  full_name: string;
  owed_minor: number;
}

export interface HistoryDay {
  business_date: BusinessDate;
  status: ClosingStatus;
  closing_id: string | null;
  /** Null while hidden by the blind count. */
  expected_cash_minor: number | null;
  counted_cash_minor: number | null;
  variance_minor: number | null;
  reason: string | null;
}

export function useClosingPreview(branchId: string, date?: BusinessDate) {
  return useQuery({
    queryKey: [...keys.closing(branchId), 'preview', date ?? 'today'],
    queryFn: async (): Promise<ClosingPreview> => {
      const { data, error } = await supabase.rpc('closing_preview', { p_branch: branchId, p_date: date });
      if (error) throw error;
      return data as unknown as ClosingPreview;
    },
  });
}

export function useClosingHistory(branchId: string) {
  return useQuery({
    queryKey: [...keys.closing(branchId), 'history'],
    queryFn: async (): Promise<HistoryDay[]> => {
      const { data, error } = await supabase.rpc('closing_history', { p_branch: branchId, p_days: 30 });
      if (error) throw error;
      return (data ?? []).map((d) => ({
        ...d,
        status: d.status as ClosingStatus,
        expected_cash_minor: d.expected_cash_minor === null ? null : Number(d.expected_cash_minor),
        counted_cash_minor: d.counted_cash_minor === null ? null : Number(d.counted_cash_minor),
        variance_minor: d.variance_minor === null ? null : Number(d.variance_minor),
      }));
    },
  });
}

/** Names of the logins who count, send in and approve closes (also those who have left since). */
export function useCounters(businessId: string) {
  return useQuery({
    queryKey: [...keys.team(businessId), 'counters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, display_name, role')
        .eq('business_id', businessId)
        .in('role', ['owner', 'manager', 'cashier'])
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

function useInvalidateClosing(branchId: string, businessId: string) {
  const client = useQueryClient();
  return () => {
    for (const queryKey of [keys.closing(branchId), keys.dashboard(branchId), ['accounts', businessId]]) {
      void client.invalidateQueries({ queryKey });
    }
  };
}

export interface CountInput {
  business_date: BusinessDate;
  counted_cash_minor: number | null;
  denominations: Record<string, number>;
  drawer_closed_confirmed: boolean;
  reason: string | null;
  taken_out_minor: number;
  taken_out_to: 'bank' | 'owner' | null;
  submit: boolean;
  approve: boolean;
}

export function useSubmitCount(branchId: string, businessId: string) {
  const done = useInvalidateClosing(branchId, businessId);
  return useMutation({
    mutationFn: async (input: CountInput) => {
      const { data, error } = await supabase.rpc('submit_cash_count', { p: asJson({ ...input, branch_id: branchId }) });
      if (error) throw error;
      return data as unknown as Closing;
    },
    onSuccess: done,
  });
}

export function useApproveClosing(branchId: string, businessId: string) {
  const done = useInvalidateClosing(branchId, businessId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('approve_cash_closing', { p_id: id });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function useReturnClosing(branchId: string, businessId: string) {
  const done = useInvalidateClosing(branchId, businessId);
  return useMutation({
    mutationFn: async (input: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('return_cash_closing', { p_id: input.id, p_reason: input.reason });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function usePayTips(branchId: string, businessId: string) {
  const done = useInvalidateClosing(branchId, businessId);
  return useMutation({
    mutationFn: async (input: { employee_id: string; amount_minor: number; client_ref: string }) => {
      const { error } = await supabase.rpc('pay_tips', { p: asJson({ ...input, branch_id: branchId }) });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

/** Cash put into the drawer today, from the owner's pocket or drawn from the bank (Dr cash, Cr owner equity / bank). */
export function useAddDrawerCash(branchId: string, businessId: string) {
  const done = useInvalidateClosing(branchId, businessId);
  return useMutation({
    mutationFn: async (input: { amount_minor: number; from: 'owner' | 'bank'; note: string }) => {
      const { error } = await supabase.rpc('add_drawer_cash', { p: asJson({ ...input, branch_id: branchId }) });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

/** Cash taken out to the bank at an approved close: the day it reached the bank and the slip number. No money moves. */
export function useRecordBankDeposit(branchId: string, businessId: string) {
  const done = useInvalidateClosing(branchId, businessId);
  return useMutation({
    mutationFn: async (input: { closing_id: string; banked_on: BusinessDate; ref: string }) => {
      const { error } = await supabase.rpc('record_bank_deposit', {
        p_closing: input.closing_id,
        p_banked_on: input.banked_on,
        p_ref: input.ref,
      });
      if (error) throw error;
    },
    onSuccess: done,
  });
}
