/** The salon's plan (docs/06; full update, Phase 6): its access and price, the owner's request, the pilot code. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';
import { parseISO } from 'date-fns/parseISO';

import { isCurrency, type CurrencyCode } from '@/lib/currencies';
import { supabase } from '@/lib/supabase';

export const planKey = (businessId: string) => ['plan', businessId] as const;

export type AccessType = 'trial' | 'pilot' | 'paid' | 'comp';

/** One branch's line of the bill: its people (the owner and the accountant count at the first branch) and price. */
export interface BranchLine {
  branch_id: string;
  name: string;
  people: number;
  extra_people: number;
  monthly_minor: number;
}

/**
 * The salon's plan (full update, Phase 6): its access — the free period, the pilot, paid, or free for good; billing
 * switched on or off for everyone — and its price per branch: the base covers `included_people` sign-ins at a branch,
 * each one after that adds the extra; totals for 1, 6 (10% off) and 12 months (the price of 10).
 */
export interface PlanStatus {
  /** New work can be saved (the server's one access check). */
  active: boolean;
  /** Off: nobody is asked to pay and no price or plan is shown in the app. */
  billing_enabled: boolean;
  access_type: AccessType;
  /** The last free day (free period or pilot). */
  free_until: string | null;
  /** In the free period or the pilot, or free for good. */
  free: boolean;
  pilot_code: string | null;
  paid_until: string | null;
  paid: boolean;
  /** In the public free period (not a pilot). */
  trial: boolean;
  /** The salon's business date. */
  today: string;
  /** Everyone who signs in: the owner and every staff login. */
  people: number;
  included_people: number;
  base_minor: number;
  extra_person_minor: number;
  /** Every branch together, for one month. */
  monthly_minor: number;
  /** AED in the UAE, USD elsewhere. */
  currency: CurrencyCode;
  branches: BranchLine[];
  lengths: { months: number; total_minor: number }[];
  requested_at: string | null;
  requested_months: number | null;
}

export function usePlanStatus(businessId: string) {
  return useQuery({
    queryKey: planKey(businessId),
    queryFn: async (): Promise<PlanStatus> => {
      const { data, error } = await supabase.rpc('plan_status', { p_business: businessId });
      if (error) throw error;
      const r = data as unknown as PlanStatus;
      return {
        ...r,
        people: Number(r.people),
        included_people: Number(r.included_people),
        base_minor: Number(r.base_minor),
        extra_person_minor: Number(r.extra_person_minor),
        monthly_minor: Number(r.monthly_minor),
        currency: isCurrency(r.currency) ? r.currency : 'AED',
        branches: (r.branches ?? []).map((b) => ({
          ...b,
          people: Number(b.people),
          extra_people: Number(b.extra_people),
          monthly_minor: Number(b.monthly_minor),
        })),
        lengths: (r.lengths ?? []).map((l) => ({ months: Number(l.months), total_minor: Number(l.total_minor) })),
      };
    },
  });
}

/** Free days left after today: 0 on the last free day (and after it). */
export function freeDaysLeft(p: Pick<PlanStatus, 'free_until' | 'today'>): number {
  return p.free_until ? Math.max(differenceInCalendarDays(parseISO(p.free_until), parseISO(p.today)), 0) : 0;
}

/** Prices, plans and payment show only while billing is on and the salon is not free (brief: nothing about paying
 *  while billing is off or during the free period or the pilot). */
export function showsBilling(p: Pick<PlanStatus, 'billing_enabled' | 'free'>): boolean {
  return p.billing_enabled && !p.free;
}

export type PilotRefusal =
  | 'invalid_code'
  | 'code_expired'
  | 'code_used_up'
  | 'pilot_already'
  | 'pilot_not_needed'
  | 'pilot_full'
  | 'too_many_attempts';

/** The owner enters a pilot code; the server checks it (any letter case) and answers ok or why not. */
export function useRedeemPilotCode(businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('redeem_pilot_code', { p_business: businessId, p_code: code });
      if (error) throw error;
      return data as unknown as { ok: boolean; reason?: PilotRefusal; free_until?: string };
    },
    onSuccess: (r) => {
      if (r.ok) void client.invalidateQueries({ queryKey: planKey(businessId) });
    },
  });
}

export function useRequestPlan(businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { months: number; note: string }) => {
      const { error } = await supabase.rpc('request_plan', { p_business: businessId, p_months: v.months, p_note: v.note });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: planKey(businessId) }),
  });
}

export function useIsPlatformAdmin() {
  return useQuery({
    queryKey: ['platform', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_platform_admin');
      if (error) throw error;
      return data === true;
    },
    staleTime: 5 * 60_000,
  });
}

export interface AdminSalon {
  business_id: string;
  name: string;
  code: string;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  branches: number;
  paid_until: string | null;
  active: boolean;
  requested_at: string | null;
  requested_months: number | null;
  request_note: string | null;
  country_code: string;
  timezone: string;
  people: number;
  monthly_minor: number;
  plan_currency: CurrencyCode;
  /** In the public free period (when active). */
  trial: boolean;
  access_type: AccessType | null;
  free_until: string | null;
  pilot_code: string | null;
  admin_note: string | null;
  /** Active staff logins (not the owner). */
  staff: number;
  last_active: string | null;
}

export function useAdminSalons() {
  return useQuery({
    queryKey: ['platform', 'salons'],
    queryFn: async (): Promise<AdminSalon[]> => {
      const { data, error } = await supabase.rpc('admin_salons');
      if (error) throw error;
      return (data ?? []).map((s) => ({
        ...s,
        monthly_minor: Number(s.monthly_minor),
        plan_currency: isCurrency(s.plan_currency) ? s.plan_currency : 'AED',
        access_type: (s.access_type as AccessType | null) ?? null,
      }));
    },
  });
}

export function useAdminPlanAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      v: { business: string; action: 'activate'; months: number; amount_minor: number; note: string } | { business: string; action: 'end'; note: string },
    ) => {
      const { error } =
        v.action === 'activate'
          ? await supabase.rpc('admin_activate', { p_business: v.business, p_months: v.months, p_amount_minor: v.amount_minor, p_note: v.note })
          : await supabase.rpc('admin_end_plan', { p_business: v.business, p_note: v.note });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['platform'] }),
  });
}

/** Where salons pay (set by the platform owner): bank transfer details and/or a card payment link. */
export interface PaymentDetails {
  bank_name: string | null;
  bank_account_name: string | null;
  bank_iban: string | null;
  bank_swift: string | null;
  pay_link_url: string | null;
  pay_note: string | null;
}

/** The plan prices and the trial's length, for the website (visitors may read only these columns). */
export function usePublicPrices() {
  return useQuery({
    queryKey: ['platform', 'prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('price_per_branch_minor, currency, intl_price_per_branch_minor, intl_currency, included_people, extra_person_minor, intl_extra_person_minor, trial_days')
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function usePaymentDetails() {
  return useQuery({
    queryKey: ['platform', 'payment-details'],
    queryFn: async (): Promise<PaymentDetails> => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('bank_name, bank_account_name, bank_iban, bank_swift, pay_link_url, pay_note')
        .single();
      if (error) throw error;
      return data as PaymentDetails;
    },
  });
}

export function useSetPaymentDetails() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: Record<keyof PaymentDetails, string>) => {
      const { error } = await supabase.rpc('admin_set_payment_details', { p: v });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['platform', 'payment-details'] }),
  });
}
