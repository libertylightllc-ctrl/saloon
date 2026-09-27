/**
 * Payroll: adjustments (bonus, deduction, advance), the month's run (generated → approved → paid) and WPS
 * proof. Owner and accountant read everything; staff read only their own approved payslips (row security).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import { uploadPhoto, type PickedPhoto } from '@/features/moneyout/receipts';
import type { MonthKey } from '@/lib/dates';
import { asJson, supabase } from '@/lib/supabase';

export type AdjustmentKind = 'bonus' | 'deduction' | 'advance';
export type RunStatus = 'generated' | 'approved' | 'paid';

export interface Payslip {
  id: string;
  employee_id: string;
  base_minor: number;
  commission_minor: number;
  bonus_minor: number;
  deductions_minor: number;
  advances_minor: number;
  net_minor: number;
  paid_method: 'cash' | 'bank' | null;
  paid_at: string | null;
  wps_status: 'na' | 'required' | 'proven';
  wps_evidence_path: string | null;
  employees: { full_name: string } | null;
  payroll_runs?: { period: string; status: RunStatus } | null;
}

export interface Run {
  id: string;
  period: string;
  status: RunStatus;
  generated_at: string;
  approved_at: string | null;
  payroll_lines: Payslip[];
}

export interface Adjustment {
  id: string;
  employee_id: string;
  kind: AdjustmentKind;
  amount_minor: number;
  method: 'cash' | 'bank' | null;
  business_date: string;
  note: string | null;
  status: 'posted' | 'reversed';
  reverse_reason: string | null;
  employees: { full_name: string } | null;
}

const LINE_FIELDS =
  'id, employee_id, base_minor, commission_minor, bonus_minor, deductions_minor, advances_minor, net_minor, paid_method, paid_at, wps_status, wps_evidence_path, employees(full_name)';

export function usePayrollRun(businessId: string, period: MonthKey) {
  return useQuery({
    queryKey: [...keys.payroll(businessId), 'run', period],
    queryFn: async (): Promise<Run | null> => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select(`id, period, status, generated_at, approved_at, payroll_lines(${LINE_FIELDS})`)
        .eq('business_id', businessId)
        .eq('period', period)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Run | null;
    },
  });
}

export function useAdjustments(businessId: string, period: MonthKey) {
  return useQuery({
    queryKey: [...keys.payroll(businessId), 'adjustments', period],
    queryFn: async (): Promise<Adjustment[]> => {
      const { data, error } = await supabase
        .from('payroll_adjustments')
        .select('id, employee_id, kind, amount_minor, method, business_date, note, status, reverse_reason, employees(full_name)')
        .eq('business_id', businessId)
        .eq('period', period)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Adjustment[];
    },
  });
}

/** Staff: my approved payslips (newest first) and this month's adjustments. */
export function useMyPay(businessId: string, employeeId: string | null) {
  return useQuery({
    enabled: Boolean(employeeId),
    queryKey: [...keys.payroll(businessId), 'mine', employeeId],
    queryFn: async () => {
      const [slips, adjustments] = await Promise.all([
        supabase.from('payroll_lines').select(`${LINE_FIELDS}, payroll_runs(period, status)`).eq('employee_id', employeeId!),
        supabase
          .from('payroll_adjustments')
          .select('id, employee_id, kind, amount_minor, method, business_date, note, status, reverse_reason, employees(full_name)')
          .eq('employee_id', employeeId!)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);
      if (slips.error) throw slips.error;
      if (adjustments.error) throw adjustments.error;
      const payslips = (slips.data as unknown as Payslip[]).sort((a, b) =>
        (b.payroll_runs?.period ?? '').localeCompare(a.payroll_runs?.period ?? ''),
      );
      return { payslips, adjustments: adjustments.data as unknown as Adjustment[] };
    },
  });
}

function useInvalidatePayroll(businessId: string, branchId: string) {
  const client = useQueryClient();
  return () => {
    for (const queryKey of [keys.payroll(businessId), keys.dashboard(branchId), keys.closing(branchId), ['accounts', businessId]]) {
      void client.invalidateQueries({ queryKey });
    }
  };
}

export function useRecordAdjustment(businessId: string, branchId: string) {
  const done = useInvalidatePayroll(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { employee_id: string; kind: AdjustmentKind; amount_minor: number; method?: 'cash' | 'bank'; note: string | null; client_ref: string }) => {
      const { error } = await supabase.rpc('record_adjustment', { p: asJson(input) });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function useReverseAdjustment(businessId: string, branchId: string) {
  const done = useInvalidatePayroll(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('reverse_adjustment', { p_id: input.id, p_reason: input.reason });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function useGeneratePayroll(businessId: string, branchId: string) {
  const done = useInvalidatePayroll(businessId, branchId);
  return useMutation({
    mutationFn: async (period: MonthKey) => {
      const { error } = await supabase.rpc('generate_payroll', { p_business: businessId, p_period: period });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function useApprovePayroll(businessId: string, branchId: string) {
  const done = useInvalidatePayroll(businessId, branchId);
  return useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase.rpc('approve_payroll', { p_run: runId });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function usePayLine(businessId: string, branchId: string) {
  const done = useInvalidatePayroll(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { line_id: string; method: 'cash' | 'bank' }) => {
      const { error } = await supabase.rpc('pay_payroll_line', { p_line: input.line_id, p_method: input.method });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function useAttachWps(businessId: string, branchId: string) {
  const done = useInvalidatePayroll(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { line_id: string; photo: PickedPhoto }) => {
      const path = await uploadPhoto('documents', `${businessId}/wps`, input.line_id, input.photo);
      const { error } = await supabase.rpc('attach_wps_evidence', { p_line: input.line_id, p_path: path });
      if (error) throw error;
    },
    onSuccess: done,
  });
}
