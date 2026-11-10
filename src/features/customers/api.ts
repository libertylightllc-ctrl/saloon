import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Customer = Tables<'customers'>;

export function useCustomers(businessId: string, search: string, enabled = true) {
  const term = search.trim();
  return useQuery({
    enabled,
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
      const [customer, sales, appointments, notes] = await Promise.all([
        // A link to a customer that no longer exists (or another salon's) finds nothing: shown as "no longer exists".
        supabase.from('customers').select('*').eq('id', id!).maybeSingle(),
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
        supabase
          .from('customer_notes')
          .select('id, note, author_name, created_at')
          .eq('customer_id', id!)
          .order('created_at', { ascending: false }),
      ]);
      for (const r of [customer, sales, appointments, notes]) if (r.error) throw r.error;
      return {
        customer: customer.data,
        sales: sales.data ?? [],
        upcoming: appointments.data ?? [],
        serviceNotes: (notes.data ?? []) as ServiceNote[],
      };
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

/** A short note on a client's visits (colour formula, what was done), with who wrote it. */
export interface ServiceNote {
  id: string;
  note: string;
  author_name: string;
  created_at: string;
}

/** A row of the customer list: the book's own rows, or a stylist's own clients (no no-show count). */
export type ListCustomer = Pick<Customer, 'id' | 'name' | 'phone' | 'visit_count' | 'last_visit_at' | 'preferences' | 'risk_flags' | 'no_show_count'>;

/**
 * A stylist's own clients (B2): customers they served or are booked with, at any time. Phone numbers only when the
 * owner's "Stylists see phone numbers" is on (the server leaves them out otherwise, and searches by name only).
 */
export function useMyClients(businessId: string, branchId: string, search: string, enabled = true) {
  const term = search.trim();
  return useQuery({
    enabled,
    queryKey: [...keys.customers(businessId), 'mine', branchId, term],
    queryFn: async (): Promise<ListCustomer[]> => {
      const { data, error } = await supabase.rpc('my_clients', { p_branch: branchId, p_search: term || undefined });
      if (error) throw error;
      return (data ?? []).map((c) => ({ ...c, risk_flags: c.risk_flags ?? [], no_show_count: 0 }));
    },
  });
}

/** One client as a stylist sees them: name, phone (when allowed), preferences, warnings, service notes, their visits. */
export interface ClientCard {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    preferences: string | null;
    risk_flags: string[];
    visit_count: number;
    last_visit_at: string | null;
  };
  service_notes: ServiceNote[];
  visits: { id: string; number: number; business_date: string; created_at: string; status: string; services: string[] | null }[];
  upcoming: { id: string; scheduled_at: string; status: string }[];
}

export function useClientCard(businessId: string, branchId: string, id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: [...keys.customers(businessId), 'card', branchId, id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('client_card', { p_branch: branchId, p_customer: id! });
      if (error) throw error;
      return data as unknown as ClientCard;
    },
  });
}

export function useAddServiceNote(businessId: string, branchId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { customerId: string; note: string }) => {
      const { error } = await supabase.rpc('add_service_note', {
        p_branch: branchId,
        p_customer: input.customerId,
        p_note: input.note,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.customers(businessId) }),
  });
}

/** Owner and manager: the duplicate's sales, bookings and notes move to the one kept, and it leaves the book. */
export function useMergeCustomers(businessId: string, branchId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keep: string; drop: string }) => {
      const { data, error } = await supabase.rpc('merge_customers', { p_branch: branchId, p_keep: input.keep, p_drop: input.drop });
      if (error) throw error;
      return data as { customer_id: string; sales_moved: number; visits_moved: number };
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.customers(businessId) }),
  });
}

/** Owner only, with a reason: the personal details go; sales stay (as "Deleted customer"), so the books do not change. */
export function useDeleteCustomer(businessId: string, branchId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('delete_customer', { p_branch: branchId, p_customer: input.id, p_reason: input.reason });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.customers(businessId) }),
  });
}
