import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Customer = Tables<'customers'>;

export function useCustomers(businessId: string, search: string) {
  const term = search.trim();
  return useQuery({
    queryKey: [...keys.customers(businessId), 'list', term],
    queryFn: async (): Promise<Customer[]> => {
      let query = supabase.from('customers').select('*').eq('business_id', businessId);
      if (term) {
        const like = `%${term.replace(/[%_,()]/g, ' ')}%`;
        query = query.or(`name.ilike.${like},phone.ilike.${like}`);
      }
      const { data, error } = await query.order('last_visit_at', { ascending: false, nullsFirst: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useCustomer(businessId: string, id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: [...keys.customers(businessId), 'one', id],
    queryFn: async () => {
      const [customer, sales, appointments] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id!).single(),
        supabase
          .from('sales')
          .select('id, number, total_minor, business_date, status, created_at')
          .eq('customer_id', id!)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('appointments')
          .select('id, scheduled_at, status, appointment_services(name_snapshot)')
          .eq('customer_id', id!)
          .in('status', ['booked', 'waiting', 'in_progress'])
          .order('scheduled_at'),
      ]);
      for (const r of [customer, sales, appointments]) if (r.error) throw r.error;
      return { customer: customer.data!, sales: sales.data ?? [], upcoming: appointments.data ?? [] };
    },
  });
}

export interface CustomerInput {
  id?: string;
  name: string;
  phone: string | null;
  preferences: string | null;
  notes: string | null;
  risk_flags: string[];
  marketing_opt_in: boolean;
}

export function useSaveCustomer(businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CustomerInput): Promise<string> => {
      if (id) {
        const { error } = await supabase.from('customers').update(input).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from('customers')
        .insert({ ...input, business_id: businessId })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.customers(businessId) }),
  });
}
