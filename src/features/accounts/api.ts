/** The owner's books: read-only views of the ledger and the history (owner and accountant). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { BusinessDate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export interface AccountTotal {
  account_id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  system_key: string | null;
  debit_minor: number;
  credit_minor: number;
}

/** Debits and credits per account for entries dated from..to (null = open-ended). */
export function useAccountTotals(businessId: string, from: BusinessDate | null, to: BusinessDate | null) {
  return useQuery({
    queryKey: ['accounts', businessId, 'totals', from, to],
    queryFn: async (): Promise<AccountTotal[]> => {
      const { data, error } = await supabase.rpc('account_totals', {
        p_business: businessId,
        p_from: from ?? undefined,
        p_to: to ?? undefined,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, debit_minor: Number(r.debit_minor), credit_minor: Number(r.credit_minor) }));
    },
  });
}

export interface StockCheck {
  /** The stock's value: every branch and item (archived ones too), below zero counted below zero. */
  stock_minor: number;
  /** 1200 Stock in the books. */
  books_minor: number;
  difference_minor: number;
}

/** Do the books' stock and the stock's own value agree (owner's app check A3)? Owner and accountant. */
export function useStockCheck(businessId: string) {
  return useQuery({
    queryKey: ['accounts', businessId, 'stock-check'],
    queryFn: async (): Promise<StockCheck> => {
      const { data, error } = await supabase.rpc('stock_books_check', { p_business: businessId });
      if (error) throw error;
      const c = data as unknown as StockCheck;
      return { stock_minor: Number(c.stock_minor), books_minor: Number(c.books_minor), difference_minor: Number(c.difference_minor) };
    },
  });
}

/** One "Stock difference" entry for what is left between the two; nothing recorded changes. */
export function useFixStockDifference(businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('fix_stock_difference', { p_business: businessId });
      if (error) throw error;
      return Number(data);
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['accounts', businessId] }),
  });
}

export interface CashPart {
  kind: string;
  entries: number;
  amount_minor: number;
}

/** Cash brought forward + each kind of cash movement on the day = expected cash. */
export function useCashBreakdown(branchId: string, date: BusinessDate) {
  return useQuery({
    queryKey: [...keys.dashboard(branchId), 'cash', date],
    queryFn: async (): Promise<CashPart[]> => {
      const { data, error } = await supabase.rpc('cash_breakdown', { p_branch: branchId, p_date: date });
      if (error) throw error;
      return (data ?? []).map((r) => ({ kind: r.kind, entries: r.entries, amount_minor: Number(r.amount_minor) }));
    },
  });
}

export interface JournalEntry {
  id: string;
  business_date: string;
  source_type: string;
  memo: string | null;
  created_at: string;
  journal_lines: { debit_minor: number; credit_minor: number; accounts: { code: string; name: string; system_key: string | null } | null }[];
}

export function useJournal(businessId: string, limit = 60) {
  return useQuery({
    queryKey: ['accounts', businessId, 'journal', limit],
    queryFn: async (): Promise<JournalEntry[]> => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, business_date, source_type, memo, created_at, journal_lines(debit_minor, credit_minor, accounts(code, name, system_key))')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as JournalEntry[];
    },
  });
}

export interface HistoryItem {
  id: string;
  action: string;
  entity_type: string;
  summary: string;
  created_at: string;
  members: { display_name: string } | null;
}

export function useActivityHistory(businessId: string, limit = 100) {
  return useQuery({
    queryKey: ['accounts', businessId, 'history', limit],
    queryFn: async (): Promise<HistoryItem[]> => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, entity_type, summary, created_at, members(display_name)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as HistoryItem[];
    },
  });
}

export interface SignIn {
  id: string;
  event: string;
  device: string | null;
  created_at: string;
  members: { display_name: string; role: string } | null;
}

export function useSignIns(businessId: string, limit = 100) {
  return useQuery({
    queryKey: ['accounts', businessId, 'signins', limit],
    queryFn: async (): Promise<SignIn[]> => {
      const { data, error } = await supabase
        .from('access_history')
        .select('id, event, device, created_at, members(display_name, role)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as SignIn[];
    },
  });
}

/** Money in the books, by account type (credit-normal types count credits as positive). */
export function balanceOf(a: Pick<AccountTotal, 'type' | 'debit_minor' | 'credit_minor'>): number {
  const net = a.debit_minor - a.credit_minor;
  return a.type === 'asset' || a.type === 'expense' ? net : -net;
}
