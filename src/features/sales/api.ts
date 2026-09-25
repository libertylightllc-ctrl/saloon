import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { Tables } from '@/lib/database.types';
import { asJson, supabase } from '@/lib/supabase';

export type PaymentMethod = 'cash' | 'card' | 'wallet';
export type Sale = Tables<'sales'>;
export type SaleDetail = Sale & {
  sale_lines: Tables<'sale_lines'>[];
  sale_payments: Tables<'sale_payments'>[];
  refunds: Tables<'refunds'>[];
  employees: Pick<Tables<'employees'>, 'full_name'> | null;
};

export interface SaleLineInput {
  kind: 'service' | 'custom';
  service_id?: string;
  name?: string;
  unit_price_minor?: number;
  qty: number;
  employee_id?: string | null;
}

export interface SaleInput {
  client_ref: string;
  appointment_id?: string | null;
  customer_id?: string | null;
  employee_id?: string | null;
  lines: SaleLineInput[];
  discount_minor?: number;
  tip_minor?: number;
  payments: { method: PaymentMethod; amount_minor: number }[];
}

export interface SaleResult {
  sale_id: string;
  number: number;
  total_minor: number;
  vat_minor: number;
  deposit_applied_minor: number;
  due_minor: number;
  warnings: string[];
}

export function useCreateSale(businessId: string, branchId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaleInput): Promise<SaleResult> => {
      const { data, error } = await supabase.rpc('create_sale', { p: asJson({ ...input, branch_id: branchId }) });
      if (error) throw error;
      return data as unknown as SaleResult;
    },
    onSuccess: () => {
      for (const queryKey of [keys.sales(branchId), keys.dashboard(branchId), keys.appointments(branchId),
        keys.customers(businessId), keys.stock(branchId)]) {
        void client.invalidateQueries({ queryKey });
      }
    },
  });
}

export function useRecentSales(branchId: string) {
  return useQuery({
    queryKey: keys.sales(branchId),
    queryFn: async (): Promise<Sale[]> => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });
}

export function useSale(saleId: string | undefined) {
  return useQuery({
    enabled: Boolean(saleId),
    queryKey: keys.sale(saleId ?? ''),
    queryFn: async (): Promise<SaleDetail> => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_lines(*), sale_payments(*), refunds(*), employees!sales_employee_id_fkey(full_name)')
        .eq('id', saleId!)
        .single();
      if (error) throw error;
      return data as unknown as SaleDetail;
    },
  });
}

export function useRefundSale(branchId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sale_id: string;
      amount_minor: number;
      method: PaymentMethod;
      reason: string;
      idempotency_key: string;
    }) => {
      const { data, error } = await supabase.rpc('refund_sale', { p: asJson(input) });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, input) => {
      void client.invalidateQueries({ queryKey: keys.sale(input.sale_id) });
      void client.invalidateQueries({ queryKey: keys.sales(branchId) });
      void client.invalidateQueries({ queryKey: keys.dashboard(branchId) });
    },
  });
}
