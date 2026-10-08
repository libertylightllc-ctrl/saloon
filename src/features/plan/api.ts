/** The salon's paid plan (docs/06): its status, the owner's request, and the platform owner's tools. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isCurrency, type CurrencyCode } from '@/lib/currencies';
import { supabase } from '@/lib/supabase';

export const planKey = (businessId: string) => ['plan', businessId] as const;

/** Priced by people, per salon: the base covers `included_people` sign-ins; each one after adds the extra. */
export interface PlanStatus {
  active: boolean;
  paid_until: string | null;
  /** Everyone who signs in: the owner and every staff login. */
  people: number;
  included_people: number;
  base_minor: number;
  extra_person_minor: number;
  monthly_minor: number;
  /** AED in the UAE, USD elsewhere. */
  currency: CurrencyCode;
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
  country_code: string;
  timezone: string;
  people: number;
  monthly_minor: number;
  plan_currency: CurrencyCode;
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

/** The plan prices, for the website (visitors may read these four columns only, migration 39). */
export function usePublicPrices() {
  return useQuery({
    queryKey: ['platform', 'prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('price_per_branch_minor, currency, intl_price_per_branch_minor, intl_currency, included_people, extra_person_minor, intl_extra_person_minor')
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
