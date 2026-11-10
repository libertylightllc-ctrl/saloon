/** Manager approval with a PIN on the same device (brief B5). */
import { useMutation, useQuery } from '@tanstack/react-query';

import type { Json } from '@/lib/database.types';
import { AppError, errorCode } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type ApprovalAction = 'discount' | 'price_change' | 'refund' | 'deposit_refund' | 'petty_cash' | 'clock_other';

/** What needs approving: the action, the amount it must cover (bps for a discount, minor units otherwise), and the line
 * the sheet shows ("Discount 25% (limit 10%)"). */
export interface ApprovalRequest {
  action: ApprovalAction;
  amount?: number | null;
  reason?: string | null;
  details?: { [key: string]: Json };
  summary: string;
}

export interface Approved {
  id: string;
  name: string;
}

export interface Approver {
  member_id: string;
  name: string;
  role: 'owner' | 'manager';
  locked: boolean;
}

/** The server refused the action until a manager or the owner approves it. */
export function isApprovalNeeded(error: unknown): boolean {
  return errorCode(error) === 'approval_needed';
}

/** The owner and the branch's managers who have a PIN (not me). */
export function useApprovers(branchId: string) {
  return useQuery({
    queryKey: ['approvers', branchId],
    staleTime: 0,
    queryFn: async (): Promise<Approver[]> => {
      const { data, error } = await supabase.rpc('approvers', { p_branch: branchId });
      if (error) throw error;
      return (data ?? []) as Approver[];
    },
  });
}

/** The approver types their PIN. A wrong PIN throws `wrong_pin` with the tries left as its detail. */
export function useApproveWithPin(branchId: string) {
  return useMutation({
    mutationFn: async ({ request, approver, pin }: { request: ApprovalRequest; approver: string; pin: string }): Promise<Approved> => {
      const { data, error } = await supabase.rpc('approve_with_pin', {
        p_branch: branchId,
        p_approver: approver,
        p_pin: pin,
        p_action: request.action,
        p_amount: request.amount ?? undefined,
        p_reason: request.reason ?? undefined,
        p_details: request.details ?? {},
      });
      if (error) throw error;
      const r = data as { ok: boolean; approval_id?: string; approved_name?: string; error?: string; tries_left?: number };
      if (r.ok && r.approval_id) return { id: r.approval_id, name: r.approved_name ?? '' };
      if (r.error === 'pin_locked') throw new AppError('pin_locked');
      if (r.error === 'no_pin') throw new AppError('no_pin');
      throw new AppError('wrong_pin', r.tries_left === undefined ? undefined : String(r.tries_left));
    },
  });
}

/** A line of Reports → Approvals: a PIN approval that was used, or a manager's or the owner's own action with a reason. */
export interface ApprovalLogRow {
  id: string;
  action: ApprovalAction;
  method: 'pin' | 'reason';
  /** A discount in basis points; money in minor units. */
  amount: number | null;
  limit_amount: number | null;
  reason: string | null;
  requested_name: string;
  approved_name: string;
  ref_type: string | null;
  ref_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

/** The branch's approvals in [from, to), newest first (owner, and managers of the branch). */
export function useApprovalLog(branchId: string, from: Date, to: Date) {
  return useQuery({
    queryKey: ['approval-log', branchId, from.toISOString()],
    queryFn: async (): Promise<ApprovalLogRow[]> => {
      const { data, error } = await supabase
        .from('approvals')
        .select('id, action, method, amount, limit_amount, reason, requested_name, approved_name, ref_type, ref_id, details, created_at')
        .eq('branch_id', branchId)
        .not('used_at', 'is', null)
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        action: r.action as ApprovalAction,
        method: r.method as ApprovalLogRow['method'],
        amount: r.amount === null ? null : Number(r.amount),
        limit_amount: r.limit_amount === null ? null : Number(r.limit_amount),
        details: (r.details ?? {}) as Record<string, unknown>,
      }));
    },
  });
}
