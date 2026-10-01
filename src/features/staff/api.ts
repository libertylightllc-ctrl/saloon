/**
 * Staff profiles, weekly rosters and attendance. Pay is only in staff_directory() (owner and accountant);
 * everyone else sees names and shifts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { BusinessDate } from '@/lib/dates';
import { asJson, supabase } from '@/lib/supabase';

export type RoleTitle = 'staff' | 'therapist' | 'cashier' | 'manager';
export const ROLE_TITLES: RoleTitle[] = ['staff', 'therapist', 'cashier', 'manager'];

export interface Shift {
  weekday: number;
  start: string;
  end: string;
}

export interface StaffMember {
  employee_id: string;
  branch_id: string;
  member_id: string | null;
  username: string | null;
  full_name: string;
  employee_code: string | null;
  role_title: RoleTitle;
  commission_bps: number;
  base_salary_minor: number;
  wps_required: boolean;
  phone: string | null;
  colour: string | null;
  active: boolean;
  roster: Shift[];
}

export type AttendanceStatus = 'on_shift' | 'on_break' | 'done' | 'not_in' | 'off';
/** Clock in / out, a break, or back to work after clocking out (the time away counts as a break). */
export type ClockAction = 'in' | 'out' | 'break_start' | 'break_end' | 'resume';

export interface AttendanceRow {
  employee_id: string;
  full_name: string;
  role_title: RoleTitle;
  colour: string | null;
  shift_start: string | null;
  shift_end: string | null;
  status: AttendanceStatus;
  clock_in: string | null;
  clock_out: string | null;
  late: boolean;
  late_minutes: number;
  /** When the break running now started (on a break), and all of the day's breaks so far. */
  break_started_at: string | null;
  break_minutes: number;
}

export function useStaffDirectory(businessId: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...keys.team(businessId), 'directory'],
    queryFn: async (): Promise<StaffMember[]> => {
      const { data, error } = await supabase.rpc('staff_directory', { p_business: businessId });
      if (error) throw error;
      return (data ?? []).map((s) => ({
        ...s,
        role_title: s.role_title as RoleTitle,
        base_salary_minor: Number(s.base_salary_minor),
        roster: (s.roster ?? []) as unknown as Shift[],
      }));
    },
  });
}

export function useAttendanceDay(branchId: string, date: BusinessDate) {
  return useQuery({
    queryKey: [...keys.attendance(branchId), date],
    queryFn: async (): Promise<AttendanceRow[]> => {
      const { data, error } = await supabase.rpc('attendance_day', { p_branch: branchId, p_date: date });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, role_title: r.role_title as RoleTitle, status: r.status as AttendanceStatus }));
    },
  });
}

/** One person's recent days (their own for staff; anyone for the front desk). */
export function useAttendanceHistory(employeeId: string | undefined) {
  return useQuery({
    enabled: Boolean(employeeId),
    queryKey: ['attendance-history', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, business_date, clock_in, clock_out, late, late_minutes')
        .eq('employee_id', employeeId!)
        .order('business_date', { ascending: false })
        .limit(14);
      if (error) throw error;
      return data;
    },
  });
}

function useInvalidateStaff(businessId: string, branchId: string) {
  const client = useQueryClient();
  return () => {
    for (const queryKey of [keys.team(businessId), keys.attendance(branchId), ['employees', branchId], keys.dashboard(branchId), ['attendance-history']]) {
      void client.invalidateQueries({ queryKey });
    }
  };
}

export interface EmployeeInput {
  id?: string;
  full_name: string;
  employee_code: string | null;
  role_title: RoleTitle;
  base_salary_minor: number;
  commission_bps: number;
  wps_required: boolean;
  phone: string | null;
  active?: boolean;
}

export function useSaveEmployee(businessId: string, branchId: string) {
  const done = useInvalidateStaff(businessId, branchId);
  return useMutation({
    mutationFn: async (input: EmployeeInput) => {
      const { data, error } = await supabase.rpc('save_employee', {
        p: asJson({ ...input, business_id: businessId, branch_id: branchId }),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: done,
  });
}

export function useSetRoster(businessId: string, branchId: string) {
  const done = useInvalidateStaff(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { employee_id: string; days: Shift[] }) => {
      const { error } = await supabase.rpc('set_roster', { p_employee: input.employee_id, p_days: asJson(input.days) });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function useClock(businessId: string, branchId: string) {
  const done = useInvalidateStaff(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { employee_id: string; action: ClockAction; at?: string }) => {
      const { data, error } = await supabase.rpc('clock', { p: asJson(input) });
      if (error) throw error;
      return data as { late: boolean; late_minutes: number; clock_in: string; clock_out: string | null };
    },
    onSuccess: done,
  });
}
