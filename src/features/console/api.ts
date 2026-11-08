/**
 * The platform console (owner, 2026-10-06): the whole service for platform owners — totals, salons, accounts, plan
 * requests and payments, history — read through functions that check the caller is a platform owner.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ContactSetting } from '@/features/landing/contact';
import { useIsPlatformAdmin } from '@/features/plan/api';
import { allPages } from '@/lib/allPages';
import { supabase } from '@/lib/supabase';

export interface Overview {
  salons: number;
  salons_closed: number;
  salons_plan_active: number;
  /** In the public free period (not counted in salons_plan_active). */
  salons_trial: number;
  salons_pilot: number;
  salons_comp: number;
  /** Open salons whose last period is over (owner, 2026-11-08): with the four above, they add up to `salons`. */
  salons_ended: number;
  /** Test salons, left out of every other number here (final brief E1). */
  salons_test: number;
  billing_enabled: boolean;
  pilot_places_left: number;
  pilot_applications_new: number;
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
      const data = await allPages((from, to) => supabase.rpc('admin_salon_stats').order('business_id').range(from, to));
      return new Map(data.map((s) => [s.business_id, { ...s, sales_month_minor: Number(s.sales_month_minor) }]));
    },
  });
}

/** Salons that look like the same owner (owner's fix list C4): same owner name or number, with the other salons. */
export function useSalonDuplicates() {
  return useQuery({
    queryKey: ['platform', 'salon-duplicates'],
    queryFn: async () => {
      const data = await allPages((from, to) =>
        supabase.rpc('admin_salon_duplicates').order('business_id').order('reason').range(from, to),
      );
      const bySalon = new Map<string, { name?: string[]; phone?: string[] }>();
      for (const d of data) bySalon.set(d.business_id, { ...bySalon.get(d.business_id), [d.reason]: d.others });
      return bySalon;
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
  /** The owner's mobile / WhatsApp number from sign-up or setup, and whether (and when) they said OK to WhatsApp. */
  phone: string | null;
  whatsapp_ok: boolean;
  whatsapp_ok_at: string | null;
};

export function useAccounts() {
  return useQuery({
    queryKey: ['platform', 'accounts'],
    queryFn: async (): Promise<Account[]> => {
      // Newest first, as the function orders them, past the API's 1,000 rows.
      return (await allPages((from, to) => supabase.rpc('admin_accounts').range(from, to))) as Account[];
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

/** Close a salon: every login switched off, the plan ended; nothing deleted. A reason is needed. */
export function useCloseSalon() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ business, note }: { business: string; note: string }) => {
      const { error } = await supabase.rpc('admin_close_salon', { p_business: business, p_note: note.trim() });
      if (error) throw error;
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['platform'] }),
  });
}

/** Billing for everyone and the free days (full update, Phase 6 g). */
export interface BillingSettings {
  billing_enabled: boolean;
  public_free_days: number;
  pilot_free_days: number;
  pilot_max_salons: number;
}

export function useBillingSettings() {
  return useQuery({
    queryKey: ['platform', 'billing'],
    queryFn: async (): Promise<BillingSettings> => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('billing_enabled, public_free_days, pilot_free_days, pilot_max_salons')
        .single();
      if (error) throw error;
      return data as unknown as BillingSettings;
    },
  });
}

export function useSetBilling() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<BillingSettings>) => {
      const { error } = await supabase.rpc('admin_set_billing', { p });
      if (error) throw error;
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['platform'] }),
  });
}

/** The WhatsApp number and message (owner's fix list A4): typed as people write them; the database keeps +E.164. */
export function useSetContact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ number, message }: { number: string; message: string }) => {
      const { data, error } = await supabase.rpc('admin_set_contact', { p_number: number, p_message: message });
      if (error) throw error;
      return data as unknown as ContactSetting;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['site-contact'] });
      void client.invalidateQueries({ queryKey: ['platform'] });
    },
  });
}

export type AccessAction = 'pilot' | 'extend' | 'set_end' | 'end_now' | 'comp' | 'note';

/** The salons marked as test salons (final brief E1): labelled "Test" in the lists, left out of the Overview. */
export function useTestSalons() {
  return useQuery({
    queryKey: ['platform', 'test-salons'],
    queryFn: async () => {
      const data = await allPages((from, to) => supabase.rpc('admin_test_salons').order('business_id').range(from, to));
      return new Set(data.map((r) => r.business_id));
    },
  });
}

/** Mark or unmark a test salon; the Overview, the lists and Changes follow. */
export function useSetTestSalon() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { businessId: string; test: boolean }) => {
      const { error } = await supabase.rpc('admin_set_test_salon', { p_business: v.businessId, p_test: v.test });
      if (error) throw error;
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['platform'] }),
  });
}

/** One salon's access: make pilot (days or a date), extend 30 days, set the end, end now, free for good, the note. */
export function useSetAccess() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { businessId: string; action: AccessAction; days?: number; until?: string; note?: string }) => {
      const { error } = await supabase.rpc('admin_set_access', {
        p_business: v.businessId,
        p: { action: v.action, days: v.days, until: v.until, note: v.note },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['platform'] });
      void client.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export interface PilotCode {
  code: string;
  days: number;
  max_uses: number;
  uses: number;
  expires_on: string | null;
  note: string | null;
  disabled: boolean;
  created_at: string;
  created_by: string | null;
}

export function usePilotCodes() {
  return useQuery({
    queryKey: ['platform', 'pilot-codes'],
    queryFn: async (): Promise<PilotCode[]> => {
      const { data, error } = await supabase.rpc('admin_pilot_codes');
      if (error) throw error;
      return (data ?? []) as unknown as PilotCode[];
    },
  });
}

export function useCreatePilotCode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (p: { code?: string; days?: number; max_uses?: number; expires_on?: string; note?: string }) => {
      const { data, error } = await supabase.rpc('admin_create_pilot_code', { p });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['platform'] }),
  });
}

export function useDisablePilotCode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.rpc('admin_disable_pilot_code', { p_code: code });
      if (error) throw error;
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['platform'] }),
  });
}

export interface PilotApplication {
  id: string;
  name: string;
  salon_name: string;
  emirate: string;
  area: string | null;
  salon_type: string;
  staff_count: number;
  whatsapp: string;
  language: string;
  whatsapp_ok: boolean;
  status: 'new' | 'approved' | 'declined';
  code: string | null;
  created_at: string;
  decided_at: string | null;
}

const pilotApplications = {
  queryKey: ['platform', 'pilot-applications'],
  queryFn: async (): Promise<PilotApplication[]> => {
    const { data, error } = await supabase.rpc('admin_pilot_applications');
    if (error) throw error;
    return (data ?? []) as unknown as PilotApplication[];
  },
};

export function usePilotApplications() {
  return useQuery(pilotApplications);
}

/**
 * How many applications are still New, for the badges (owner's fix list A1: the Pilot tab, More, the sidebar, the
 * bell, the browser tab): platform owners only, looked at again every 2 minutes; 0 for everyone else. Approving or
 * declining one refreshes it at once (the decision refreshes every platform query).
 */
export function useNewPilotApplications(): number {
  const admin = useIsPlatformAdmin();
  const apps = useQuery({ ...pilotApplications, enabled: admin.data === true, refetchInterval: 2 * 60_000 });
  return admin.data === true ? (apps.data ?? []).filter((a) => a.status === 'new').length : 0;
}

/** Approve (a one-use code for the pilot's days, for a WhatsApp message) or decline. */
export function useDecidePilotApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; approve: boolean }) => {
      const { data, error } = await supabase.rpc('admin_decide_pilot_application', { p_id: v.id, p_approve: v.approve });
      if (error) throw error;
      return data as unknown as { code: string | null; name: string; whatsapp: string; language: string; days: number };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['platform'] }),
  });
}

export interface AuditRow {
  id: string;
  actor: string | null;
  action: string;
  salon: string | null;
  subject: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

/** Who changed what and when, with the old and new values. */
export function usePlatformAudit() {
  return useQuery({
    queryKey: ['platform', 'audit'],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase.rpc('admin_platform_audit', { p_limit: 300 });
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });
}
