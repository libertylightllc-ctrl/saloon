import { useQuery } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { AttendanceStatus } from '@/features/staff/api';
import { supabase } from '@/lib/supabase';

export interface Dashboard {
  business_date: string;
  role: string;
  /** Null while the blind count hides it (front desk, before the day's count). */
  expected_cash?: number | null;
  expected_cash_yesterday?: number | null;
  /** total_minor is without the tip; tips_minor is the day's tips (owner's app check A7). */
  sales?: { count: number; total_minor: number; tips_minor?: number; refunded_minor: number; services: number };
  payment_mix?: { cash: number; card: number; wallet: number; deposits: number };
  revenue_7d?: { date: string; total_minor: number }[];
  top_services?: { name: string; count: number; revenue_minor: number }[];
  staff_today?: {
    employee_id: string;
    name: string;
    colour: string | null;
    services: number;
    sales_minor: number;
    /** Null for cashiers (no payroll on their Home). */
    commission_minor: number | null;
    busy: boolean;
    /** From the roster and the clock (owner's app check A5): 'available' means no roster at all and not clocked in. */
    status?: AttendanceStatus | 'available';
    /** Set when they clocked in late today. */
    late_minutes: number | null;
    shift_start: string | null;
    shift_end: string | null;
  }[];
  activity?: { summary: string; at: string; actor: string | null }[];
  money_out?: { expenses_minor: number; supplier_payments_minor: number };
  /** Low is above 0; out is 0 or below, only items that had stock here (owner's app check A6). */
  stock?: { low: number; low_items: string[]; out?: number; out_items?: string[]; tools_due: number };
  bills?: { overdue_count: number; overdue_minor: number; due_soon_count: number; due_soon_minor: number } | null;
  payroll?: { pending_period: string | null; wps_missing: number } | null;
  /** One count per record status (owner's app check A4), and the days to the nearest expiry in its reminder window. */
  compliance?: {
    readiness: number;
    attention: number;
    expired: number;
    missing: number;
    missing_date: number;
    evidence_missing: number;
    due_soon: number;
    soonest_days: number | null;
  } | null;
  hygiene_signed?: boolean | null;
  /** Shifts on earlier days with no clock-out (D1): owner and managers. */
  missed_clock_outs?: number | null;
  closing?: {
    today_status: 'open' | 'draft' | 'pending_approval' | 'approved';
    pending_approval: number;
    pending: { id: string; business_date: string; variance_minor: number | null }[];
    unclosed_days: string[];
  };
  appointments?: { completed: number; waiting: number; in_progress: number; booked: number; no_show: number };
  setup?: { services: boolean; staff: boolean; tax: boolean; opening_cash: boolean; opening_stock: boolean; suppliers: boolean };
  /** The stylist's own day (brief B8); tips_today_minor less any tip refunded today. */
  me?: { services_today: number; sales_today_minor: number; commission_month_minor: number; tips_today_minor?: number };
}

export function useDashboard(branchId: string) {
  return useQuery({
    queryKey: keys.dashboard(branchId),
    queryFn: async (): Promise<Dashboard> => {
      const { data, error } = await supabase.rpc('dashboard_today', { p_branch: branchId });
      if (error) throw error;
      return data as unknown as Dashboard;
    },
  });
}

/** The stylist's own commission rate (basis points); Home leaves out "Commission this month" at 0% (E8). */
export function useMyCommissionRate(employeeId: string | null) {
  return useQuery({
    enabled: Boolean(employeeId),
    queryKey: ['employee', employeeId, 'commission-rate'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.from('employees').select('commission_bps').eq('id', employeeId!).single();
      if (error) throw error;
      return Number(data.commission_bps ?? 0);
    },
  });
}

/**
 * Show the commission tile: a rate above 0%, or commission already earned this month (the rate changed since).
 * `rateBps`: undefined while loading (shown only if earned, so a 0% stylist never sees it flash), null if it could not
 * be read (shown, as before).
 */
export function showsCommission(rateBps: number | null | undefined, monthMinor: number): boolean {
  return rateBps === null || (rateBps ?? 0) > 0 || monthMinor !== 0;
}
