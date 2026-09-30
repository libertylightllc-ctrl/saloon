/** Reports (owner and accountant): one query per report for a branch and month, and the owner control line. */
import { useQuery } from '@tanstack/react-query';

import type { Database } from '@/lib/database.types';
import type { MonthKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export const REPORT_TYPES = ['monthly', 'staff', 'closing', 'stock', 'shortages', 'customers', 'vat'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface MonthlyDay {
  date: string;
  sales_minor: number;
  sales: number;
  services: number;
  refunds_minor: number;
  expenses_minor: number;
}
export interface MonthlyReport {
  month: string;
  days: MonthlyDay[];
  revenue_minor: number;
  costs_minor: number;
  prev_revenue_minor: number;
  prev_costs_minor: number;
}
export interface StaffRow {
  employee_id: string;
  full_name: string;
  services: number;
  sales_minor: number;
  revenue_minor: number;
  commission_minor: number;
  tips_minor: number;
  days_worked: number;
  late_days: number;
}
export interface ClosingRow {
  business_date: string;
  status: string;
  expected_minor: number;
  counted_minor: number | null;
  variance_minor: number | null;
  taken_out_minor: number;
  reason: string | null;
  counted_by: string | null;
  approved_by: string | null;
}
export interface StockRow {
  item_id: string;
  name: string;
  kind: string;
  unit: string;
  opening: number;
  qty_in: number;
  qty_out: number;
  closing: number;
  value_minor: number;
}
export interface ShortageRow {
  business_date: string;
  status: string;
  variance_minor: number;
  reason: string | null;
  counted_by: string | null;
  approved_by: string | null;
}
export interface CustomerRow {
  customer_id: string;
  name: string;
  phone: string | null;
  visits: number;
  last_visit_at: string | null;
  spent_minor: number;
  month_visits: number;
  month_spent_minor: number;
}

/** One kind of VAT entry for the month: output (sales, refunds) or input (purchases, expenses). */
export interface VatRow {
  kind: 'sales' | 'refunds' | 'purchases' | 'expenses';
  entries: number;
  taxable_minor: number;
  vat_minor: number;
}

export type ReportData =
  | { type: 'monthly'; data: MonthlyReport }
  | { type: 'staff'; data: StaffRow[] }
  | { type: 'closing'; data: ClosingRow[] }
  | { type: 'stock'; data: StockRow[] }
  | { type: 'shortages'; data: ShortageRow[] }
  | { type: 'customers'; data: CustomerRow[] }
  | { type: 'vat'; data: VatRow[] };

type Functions = Database['public']['Functions'];
type Returned<F extends keyof Functions> = Functions[F]['Returns'] extends (infer R)[] ? R : never;

/** The API answers at most 1,000 rows at a time: read a table-returning report page by page, so exports are whole. */
const PAGE = 1000;
async function allRows<F extends keyof Functions>(fn: F, args: Record<string, string>): Promise<Returned<F>[]> {
  const rows: Returned<F>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.rpc(fn as 'report_staff', args as { p_branch: string; p_month: string }).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Returned<F>[]));
    if ((data ?? []).length < PAGE) return rows;
  }
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function fetchReport(type: ReportType, businessId: string, branchId: string, month: MonthKey): Promise<ReportData> {
  const args = { p_branch: branchId, p_month: month };
  switch (type) {
    case 'monthly': {
      const { data, error } = await supabase.rpc('report_monthly', args);
      if (error) throw error;
      const r = data as unknown as MonthlyReport;
      return {
        type,
        data: {
          ...r,
          days: r.days.map((d) => ({ ...d, sales_minor: num(d.sales_minor), refunds_minor: num(d.refunds_minor), expenses_minor: num(d.expenses_minor), services: num(d.services) })),
        },
      };
    }
    case 'staff': {
      const data = await allRows('report_staff', args);
      return {
        type,
        data: (data ?? []).map((r) => ({
          ...r,
          services: num(r.services),
          sales_minor: num(r.sales_minor),
          revenue_minor: num(r.revenue_minor),
          commission_minor: num(r.commission_minor),
          tips_minor: num(r.tips_minor),
        })),
      };
    }
    case 'closing': {
      const data = await allRows('report_closing', args);
      return {
        type,
        data: (data ?? []).map((r) => ({
          ...r,
          expected_minor: num(r.expected_minor),
          counted_minor: numOrNull(r.counted_minor),
          variance_minor: numOrNull(r.variance_minor),
          taken_out_minor: num(r.taken_out_minor),
        })),
      };
    }
    case 'stock': {
      const data = await allRows('report_stock', args);
      return {
        type,
        data: (data ?? []).map((r) => ({
          ...r,
          opening: num(r.opening),
          qty_in: num(r.qty_in),
          qty_out: num(r.qty_out),
          closing: num(r.closing),
          value_minor: num(r.value_minor),
        })),
      };
    }
    case 'shortages': {
      const data = await allRows('report_shortages', args);
      return { type, data: (data ?? []).map((r) => ({ ...r, variance_minor: num(r.variance_minor) })) };
    }
    case 'customers': {
      const data = await allRows('report_customers', { p_business: businessId, p_month: month });
      return {
        type,
        data: (data ?? []).map((r) => ({ ...r, spent_minor: num(r.spent_minor), month_spent_minor: num(r.month_spent_minor) })),
      };
    }
    case 'vat': {
      const data = await allRows('report_vat', args);
      return {
        type,
        data: data.map((r) => ({
          kind: r.kind as VatRow['kind'],
          entries: Number(r.entries),
          taxable_minor: num(r.taxable_minor),
          vat_minor: num(r.vat_minor),
        })),
      };
    }
  }
}

export function useReport(type: ReportType, businessId: string, branchId: string, month: MonthKey) {
  return useQuery({
    queryKey: ['reports', branchId, type, month],
    queryFn: () => fetchReport(type, businessId, branchId, month),
  });
}

export interface OwnerControl {
  last_close_date: string | null;
  last_close_variance_minor: number | null;
  supplier_owed_minor: number;
  low_items: number;
  /** Owner only; null for the accountant. */
  compliance_issues: number | null;
}

export function useOwnerControl(branchId: string) {
  return useQuery({
    queryKey: ['reports', branchId, 'control'],
    queryFn: async (): Promise<OwnerControl> => {
      const { data, error } = await supabase.rpc('owner_control', { p_branch: branchId });
      if (error) throw error;
      const r = data as unknown as Record<string, unknown>;
      return {
        last_close_date: (r.last_close_date as string | null) ?? null,
        last_close_variance_minor: numOrNull(r.last_close_variance_minor),
        supplier_owed_minor: num(r.supplier_owed_minor),
        low_items: num(r.low_items),
        compliance_issues: numOrNull(r.compliance_issues),
      };
    },
  });
}
