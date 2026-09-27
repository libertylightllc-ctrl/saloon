import { useQuery } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import { supabase } from '@/lib/supabase';

export interface Dashboard {
  business_date: string;
  role: string;
  expected_cash?: number;
  expected_cash_yesterday?: number;
  sales?: { count: number; total_minor: number; refunded_minor: number; services: number };
  payment_mix?: { cash: number; card: number; wallet: number; deposits: number };
  revenue_7d?: { date: string; total_minor: number }[];
  top_services?: { name: string; count: number; revenue_minor: number }[];
  staff_today?: {
    employee_id: string;
    name: string;
    colour: string | null;
    services: number;
    sales_minor: number;
    commission_minor: number;
    busy: boolean;
  }[];
  activity?: { summary: string; at: string; actor: string | null }[];
  money_out?: { expenses_minor: number; supplier_payments_minor: number };
  stock?: { low: number; low_items: string[]; tools_due: number };
  bills?: { overdue_count: number; overdue_minor: number; due_soon_count: number; due_soon_minor: number } | null;
  closing?: {
    today_status: 'open' | 'draft' | 'pending_approval' | 'approved';
    pending_approval: number;
    pending: { id: string; business_date: string; variance_minor: number | null }[];
    unclosed_days: string[];
  };
  appointments?: { completed: number; waiting: number; in_progress: number; booked: number; no_show: number };
  setup?: { services: boolean; staff: boolean; tax: boolean; opening_cash: boolean; opening_stock: boolean; suppliers: boolean };
  me?: { services_today: number; sales_today_minor: number; commission_month_minor: number };
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
