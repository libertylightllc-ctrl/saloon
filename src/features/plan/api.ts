/** The salon's paid plan (docs/06): its status, the owner's request, and the platform owner's tools. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export const planKey = (businessId: string) => ['plan', businessId] as const;

export interface PlanStatus {
  active: boolean;
  paid_until: string | null;
  branches: number;
  price_per_branch_minor: number;
  monthly_minor: number;
  currency: string;
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
        price_per_branch_minor: Number(r.price_per_branch_minor),
        monthly_minor: Number(r.monthly_minor),
        branches: Number(r.branches),
      };
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
}

export function useAdminSalons() {
  return useQuery({
    queryKey: ['platform', 'salons'],
    queryFn: async (): Promise<AdminSalon[]> => {
      const { data, error } = await supabase.rpc('admin_salons');
      if (error) throw error;
      return (data ?? []) as AdminSalon[];
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
