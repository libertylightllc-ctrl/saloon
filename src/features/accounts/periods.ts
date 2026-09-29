/** Month close (owner) and the ledger export (owner and accountant). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CsvCell } from '@/lib/exportFile';
import { formatAmount } from '@/lib/money';
import { supabase } from '@/lib/supabase';

export interface Period {
  month: string;
  status: 'open' | 'closed';
  entries: number;
  closed_at: string | null;
  closed_by: string | null;
}

export function usePeriods(businessId: string) {
  return useQuery({
    queryKey: ['accounts', businessId, 'periods'],
    queryFn: async (): Promise<Period[]> => {
      const { data, error } = await supabase.rpc('period_list', { p_business: businessId });
      if (error) throw error;
      return (data ?? []) as Period[];
    },
  });
}

export function usePeriodAction(businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { month: string; action: 'close' | 'reopen'; reason?: string }) => {
      const { error } =
        v.action === 'close'
          ? await supabase.rpc('close_period', { p_business: businessId, p_month: v.month })
          : await supabase.rpc('reopen_period', { p_business: businessId, p_month: v.month, p_reason: v.reason ?? '' });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['accounts', businessId] }),
  });
}

interface LedgerEntry {
  business_date: string;
  created_at: string;
  source_type: string;
  memo: string | null;
  journal_lines: { debit_minor: number; credit_minor: number; accounts: { code: string; name: string } | null }[];
}

const PAGE = 500;
const amount = (minor: number) => (minor ? formatAmount(minor, undefined, { grouping: false }) : '');

/** Every journal line, oldest first: date, source, memo, account, debit, credit. Read page by page. */
export async function ledgerRows(businessId: string, header: string[]): Promise<CsvCell[][]> {
  const rows: CsvCell[][] = [header];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('business_date, created_at, source_type, memo, journal_lines(debit_minor, credit_minor, accounts(code, name))')
      .eq('business_id', businessId)
      .order('business_date')
      .order('created_at')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const entries = data as unknown as LedgerEntry[];
    for (const e of entries) {
      for (const l of e.journal_lines) {
        rows.push([e.business_date, e.source_type, e.memo, l.accounts?.code, l.accounts?.name, amount(Number(l.debit_minor)), amount(Number(l.credit_minor))]);
      }
    }
    if (entries.length < PAGE) return rows;
  }
}
