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

/** A free period or pilot ending in the next 7 days (B6), and how to reach the owner. */
export interface EndingSalon {
  business_id: string;
  name: string;
  code: string;
  timezone: string;
  status: 'free' | 'pilot';
  ends_on: string;
  days_left: number;
  owner_name: string | null;
  email: string | null;
  /** Only when the owner agreed to WhatsApp. */
  whatsapp: string | null;
  /** The language the owner uses the app in ('en' when not known). */
  language: string;
  contacted_at: string | null;
}

/** A plan request still waiting (B6): no payment or ending since. */
export interface WaitingRequest {
  business_id: string;
  name: string;
  code: string;
  timezone: string;
  first_asked_at: string;
  last_asked_at: string;
  /** Whole days since it was first asked. */
  waiting_days: number;
  times: number;
  months: number | null;
}

export interface ComingUp {
  ending: EndingSalon[];
  requests: WaitingRequest[];
}

/** B6 Coming up (migration 119). */
export function useComingUp() {
  return useQuery({
    queryKey: ['platform', 'coming-up'],
    queryFn: async (): Promise<ComingUp> => {
      const { data, error } = await supabase.rpc('admin_coming_up');
      if (error) throw error;
      return data as unknown as ComingUp;
    },
  });
}

/** "Message owner": logged in Changes and in the salon's history before WhatsApp or email opens. */
export function useLogContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ business, channel }: { business: string; channel: 'whatsapp' | 'email' }) => {
      const { error } = await supabase.rpc('admin_log_contact', { p_business: business, p_channel: channel });
      if (error) throw error;
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['platform'] }),
  });
}

/** New salons in a week from one country (B8). */
export interface SignupCount {
  week: string;
  country_code: string;
  salons: number;
}

/** B8 New sign-ups: the last 12 weeks (Mondays, Dubai calendar) and the salons made in each, by country (migration 120). */
export interface Signups {
  weeks: string[];
  counts: SignupCount[];
}

export function useSignups() {
  return useQuery({
    queryKey: ['platform', 'signups-weekly'],
    queryFn: async (): Promise<Signups> => {
      const { data, error } = await supabase.rpc('admin_signups_weekly');
      if (error) throw error;
      return data as unknown as Signups;
    },
  });
}

/** B9 Support (migration 121). */
export interface SupportStats {
  open: number;
  /** Handed over by the assistant, the last word not the team's. */
  waiting: number;
  oldest_waiting_at: string | null;
  oldest_waiting_minutes: number | null;
  /** Conversations begun in the last 30 days that a person answered. */
  replied_30d: number;
  first_reply_seconds: number | null;
}

export function useSupportStats() {
  return useQuery({
    queryKey: ['platform', 'support-stats'],
    queryFn: async (): Promise<SupportStats> => {
      const { data, error } = await supabase.rpc('admin_support_stats');
      if (error) throw error;
      return data as unknown as SupportStats;
    },
  });
}

/** How one kind of automatic work went (B10). */
export interface HealthLine {
  last_ok_at: string | null;
  last_fail_at: string | null;
  last_fail: string | null;
  ok_24h: number;
  fails_24h: number;
}

export interface AppError {
  at: string;
  detail: string | null;
  screen: string | null;
  salon: string | null;
  code: string | null;
}

/** B10 System health (migration 116). */
export interface Health {
  email: HealthLine;
  card_webhook: HealthLine;
  rates: HealthLine;
  card_payments: 'off' | 'test' | 'live';
  rates_day: string | null;
  app_errors_24h: number;
  app_errors: AppError[];
}

export function useHealth() {
  return useQuery({
    queryKey: ['platform', 'health'],
    queryFn: async (): Promise<Health> => {
      const { data, error } = await supabase.rpc('admin_health');
      if (error) throw error;
      return data as unknown as Health;
    },
  });
}
