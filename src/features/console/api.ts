/**
 * The platform console (owner, 2026-10-06): the whole service for platform owners — totals, salons, accounts, plan
 * requests and payments, history — read through functions that check the caller is a platform owner.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface Overview {
  salons: number;
  salons_plan_active: number;
  plan_requests_open: number;
  branches: number;
  accounts: number;
  owners: number;
  staff_logins: number;
  no_salon: number;
  signups_7d: number;
  signups_30d: number;
  signed_in_7d: number;
  countries: { code: string; salons: number }[];
  sales_month: { currency: string; count: number; total_minor: number }[];
  plan_income: { currency: string; total_minor: number }[];
}

export function useOverview() {
  return useQuery({
    queryKey: ['platform', 'overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_overview');
      if (error) throw error;
      return data as unknown as Overview;
    },
  });
}

export function useSalonStats() {
  return useQuery({
    queryKey: ['platform', 'salon-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_salon_stats');
      if (error) throw error;
      return new Map((data ?? []).map((s) => [s.business_id, { ...s, sales_month_minor: Number(s.sales_month_minor) }]));
    },
  });
}

export type Account = {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  role: string | null;
  business_id: string | null;
  salon: string | null;
  active: boolean | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  provider: string;
  platform_owner: boolean;
};

export function useAccounts() {
  return useQuery({
    queryKey: ['platform', 'accounts'],
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase.rpc('admin_accounts');
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });
}

export function usePlanEvents() {
  return useQuery({
    queryKey: ['platform', 'plan-events'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_plan_events', { p_limit: 300 });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, amount_minor: e.amount_minor === null ? null : Number(e.amount_minor) }));
    },
  });
}

/** The history across salons, or of one salon. */
export function useActivity(businessId: string | null) {
  return useQuery({
    queryKey: ['platform', 'activity', businessId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_activity', { p_business: businessId ?? undefined, p_limit: 300 });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Name or remove a platform owner by the email they sign in with. */
export function useSetPlatformOwner() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, on }: { email: string; on: boolean }) => {
      const { error } = await supabase.rpc('admin_set_platform_owner', { p_email: email.trim(), p_on: on });
      if (error) throw error;
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['platform'] }),
  });
}
