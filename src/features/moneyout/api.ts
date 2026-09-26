/**
 * Money out: expenses, suppliers, purchase bills and supplier payments. Every write is one RPC
 * that also posts the journal entry and the audit row; each carries a client_ref so a double tap
 * or a retry never records twice.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { BusinessDate } from '@/lib/dates';
import { asJson, supabase } from '@/lib/supabase';

export type PayMethod = 'cash' | 'card' | 'bank';

export interface ExpenseCategory {
  id: string;
  key: string | null;
  name: string;
  icon: string;
  sort: number;
  archived: boolean;
}

export interface Expense {
  id: string;
  business_date: string;
  amount_minor: number;
  method: PayMethod;
  note: string | null;
  status: 'posted' | 'reversed';
  reverse_reason: string | null;
  created_at: string;
  category_id: string;
  expense_categories: { name: string; key: string | null; icon: string } | null;
  members: { display_name: string } | null;
}

/** Everything a money-out change can touch. */
function useInvalidateMoneyOut(businessId: string, branchId: string) {
  const client = useQueryClient();
  return () => {
    for (const queryKey of [keys.moneyOut(businessId), keys.dashboard(branchId), keys.stock(branchId), ['accounts', businessId]]) {
      void client.invalidateQueries({ queryKey });
    }
  };
}

export function useExpenseCategories(businessId: string) {
  return useQuery({
    queryKey: [...keys.moneyOut(businessId), 'categories'],
    queryFn: async (): Promise<ExpenseCategory[]> => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('id, key, name, icon, sort, archived')
        .eq('business_id', businessId)
        .eq('archived', false)
        .order('sort')
        .order('name');
      if (error) throw error;
      return data as ExpenseCategory[];
    },
  });
}

/** Expenses dated from..to (a month), newest first. Cashiers get only their own (row level security). */
export function useExpenses(branchId: string, businessId: string, from: BusinessDate, to: BusinessDate) {
  return useQuery({
    queryKey: [...keys.moneyOut(businessId), 'expenses', branchId, from, to],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, business_date, amount_minor, method, note, status, reverse_reason, created_at, category_id, expense_categories(name, key, icon), members!expenses_created_by_fkey(display_name)')
        .eq('branch_id', branchId)
        .gte('business_date', from)
        .lte('business_date', to)
        .order('business_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Expense[];
    },
  });
}

export function useExpense(businessId: string, id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: [...keys.moneyOut(businessId), 'expense', id],
    queryFn: async (): Promise<Expense> => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, business_date, amount_minor, method, note, status, reverse_reason, created_at, category_id, expense_categories(name, key, icon), members!expenses_created_by_fkey(display_name)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as Expense;
    },
  });
}

export interface ExpenseInput {
  category_id: string;
  amount_minor: number;
  method: PayMethod;
  business_date: BusinessDate;
  note: string | null;
  client_ref: string;
}

export function useRecordExpense(businessId: string, branchId: string) {
  const done = useInvalidateMoneyOut(businessId, branchId);
  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      const { data, error } = await supabase.rpc('record_expense', { p: asJson({ ...input, branch_id: branchId }) });
      if (error) throw error;
      return data as { expense_id: string };
    },
    onSuccess: done,
  });
}

export function useReverseExpense(businessId: string, branchId: string) {
  const done = useInvalidateMoneyOut(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('reverse_expense', { p_id: input.id, p_reason: input.reason });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function useSaveExpenseCategory(businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; icon?: string; archived?: boolean }) => {
      const { data, error } = await supabase.rpc('save_expense_category', { p: asJson({ ...input, business_id: businessId }) });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.moneyOut(businessId) }),
  });
}

// ── Suppliers & bills ─────────────────────────────────────────────────────────────────────
export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  terms_days: number;
  balance_minor?: number;
  overdue_minor?: number;
  open_bills?: number;
}

/** Owner and accountant see balances; a cashier sees the supplier list to pick from. */
export function useSuppliers(businessId: string, withBalances: boolean) {
  return useQuery({
    queryKey: [...keys.moneyOut(businessId), 'suppliers', withBalances],
    queryFn: async (): Promise<Supplier[]> => {
      if (withBalances) {
        const { data, error } = await supabase.rpc('supplier_balances', { p_business: businessId });
        if (error) throw error;
        return (data ?? []).map((s) => ({
          id: s.supplier_id,
          name: s.name,
          phone: s.phone,
          terms_days: s.terms_days,
          balance_minor: Number(s.balance_minor),
          overdue_minor: Number(s.overdue_minor),
          open_bills: s.open_bills,
        }));
      }
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, phone, terms_days')
        .eq('business_id', businessId)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveSupplier(businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; phone: string | null; terms_days: number }) => {
      const { data, error } = await supabase.rpc('save_supplier', { p: asJson({ ...input, business_id: businessId }) });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.moneyOut(businessId) }),
  });
}

export interface Bill {
  id: string;
  number: number;
  invoice_ref: string | null;
  bill_date: string;
  due_date: string;
  total_minor: number;
  paid_minor: number;
  status: 'unpaid' | 'partial' | 'paid' | 'reversed';
  note: string | null;
  reverse_reason: string | null;
  supplier_id: string;
  suppliers: { name: string } | null;
}

export interface BillDetail extends Bill {
  purchase_bill_lines: { id: string; description: string; qty: number; unit_cost_minor: number; total_minor: number; update_stock: boolean }[];
  supplier_payments: { id: string; business_date: string; method: PayMethod; amount_minor: number; created_at: string }[];
}

const BILL_FIELDS = 'id, number, invoice_ref, bill_date, due_date, total_minor, paid_minor, status, note, reverse_reason, supplier_id, suppliers(name)';

export function useBills(businessId: string) {
  return useQuery({
    queryKey: [...keys.moneyOut(businessId), 'bills'],
    queryFn: async (): Promise<Bill[]> => {
      const { data, error } = await supabase
        .from('purchase_bills')
        .select(BILL_FIELDS)
        .eq('business_id', businessId)
        .order('bill_date', { ascending: false })
        .order('number', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as Bill[];
    },
  });
}

export function useBill(businessId: string, id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: [...keys.moneyOut(businessId), 'bill', id],
    queryFn: async (): Promise<BillDetail> => {
      const { data, error } = await supabase
        .from('purchase_bills')
        .select(`${BILL_FIELDS}, purchase_bill_lines(id, description, qty, unit_cost_minor, total_minor, update_stock), supplier_payments(id, business_date, method, amount_minor, created_at)`)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as BillDetail;
    },
  });
}

export interface BillLineInput {
  item_id?: string;
  description: string;
  qty: number;
  unit_cost_minor: number;
  update_stock: boolean;
}

export interface BillInput {
  supplier_id: string;
  invoice_ref: string | null;
  bill_date: BusinessDate;
  note: string | null;
  lines: BillLineInput[];
  paid_now?: { method: PayMethod; amount_minor: number };
  client_ref: string;
}

export function usePostBill(businessId: string, branchId: string) {
  const done = useInvalidateMoneyOut(businessId, branchId);
  return useMutation({
    mutationFn: async (input: BillInput) => {
      const { data, error } = await supabase.rpc('post_purchase_bill', { p: asJson({ ...input, branch_id: branchId }) });
      if (error) throw error;
      return data as { bill_id: string; number: number; total_minor: number };
    },
    onSuccess: done,
  });
}

export function usePaySupplier(businessId: string, branchId: string) {
  const done = useInvalidateMoneyOut(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { supplier_id: string; bill_id?: string; method: PayMethod; amount_minor: number; client_ref: string }) => {
      const { error } = await supabase.rpc('pay_supplier', { p: asJson({ ...input, branch_id: branchId }) });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function useReverseBill(businessId: string, branchId: string) {
  const done = useInvalidateMoneyOut(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('reverse_purchase_bill', { p_id: input.id, p_reason: input.reason });
      if (error) throw error;
    },
    onSuccess: done,
  });
}
