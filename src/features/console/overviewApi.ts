/**
 * The Overview's business numbers (owner's brief, Part B, 24 Nov 2026): each card reads its own function, which checks
 * the caller is a platform owner, so a slow or failing card leaves the others showing.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import type { Amount, FxRates } from './fx';

/** The reporting currency and the rates the Overview converts with. */
export function useFxRates() {
  return useQuery({
    queryKey: ['platform', 'fx'],
    queryFn: async (): Promise<FxRates> => {
      const { data, error } = await supabase.rpc('admin_fx_rates');
      if (error) throw error;
      return data as unknown as FxRates;
    },
  });
}

/** Settings → Reporting currency (written to Changes). */
export function useSetReportingCurrency() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (currency: string) => {
      const { data, error } = await supabase.rpc('admin_set_reporting_currency', { p_currency: currency });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['platform'] }),
  });
}

/** A salon that stopped paying this month (B5), and where it is now. */
export interface Churned {
  business_id: string;
  name: string;
  code: string;
  stopped_on: string;
  status: 'free' | 'pilot' | 'comp' | 'ended' | 'closed';
  currency: string;
  minor: number;
}

/** B1 monthly income now and on the last day of last month, B4 free-period conversion, B5 churn (migration 117). */
export interface Revenue {
  month: string;
  paying: number;
  /** Paying salons switched on without a payment: counted, adding nothing. */
  paying_unpriced: number;
  mrr: Amount[];
  paying_prev: number;
  mrr_prev: Amount[];
  conversion: { ended: number; paid: number };
  churn: Churned[];
}

export function useRevenue() {
  return useQuery({
    queryKey: ['platform', 'revenue'],
    queryFn: async (): Promise<Revenue> => {
      const { data, error } = await supabase.rpc('admin_revenue');
      if (error) throw error;
      return data as unknown as Revenue;
    },
  });
}

/** A salon at risk (B7): nothing done for 14 days or more. */
export interface QuietSalon {
  business_id: string;
  name: string;
  code: string;
  status: 'paid' | 'free' | 'pilot' | 'comp';
  country_code: string;
  timezone: string;
  /** null: never used. */
  last_active: string | null;
}

/** B3 active salons in the last 7 and 30 days, B7 those at risk, the quietest 100 listed (migration 118). */
export interface SalonActivity {
  open: number;
  active_7d: number;
  active_30d: number;
  at_risk_count: number;
  at_risk: QuietSalon[];
}

export function useSalonActivity() {
  return useQuery({
    queryKey: ['platform', 'salon-activity'],
    queryFn: async (): Promise<SalonActivity> => {
      const { data, error } = await supabase.rpc('admin_salon_activity');
      if (error) throw error;
      return data as unknown as SalonActivity;
    },
  });
}
