import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { Tables } from '@/lib/database.types';
import { functionError } from '@/lib/errors';
import { asJson, supabase } from '@/lib/supabase';

export type TeamMember = Tables<'members'> & { employees: Pick<Tables<'employees'>, 'commission_bps' | 'colour'> | null };

export function useTeam(businessId: string) {
  return useQuery({
    queryKey: keys.team(businessId),
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from('members')
        .select('*, employees(commission_bps, colour)')
        .eq('business_id', businessId)
        .order('created_at');
      if (error) throw error;
      return data as unknown as TeamMember[];
    },
  });
}

export interface NewStaffLogin {
  display_name: string;
  username: string;
  password: string;
  role: 'cashier' | 'staff' | 'accountant';
  commission_bps: number;
  colour: string | null;
}

export function useCreateStaffLogin(businessId: string, branchId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewStaffLogin) => {
      const { data, error } = await supabase.functions.invoke('create-staff-login', {
        body: { ...input, business_id: businessId, branch_id: branchId },
      });
      if (error) throw await functionError(error);
      return data as { member_id: string; username: string };
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.team(businessId) });
      void client.invalidateQueries({ queryKey: ['employees', branchId] });
    },
  });
}

export function useManageStaffLogin(businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { member_id: string } & ({ action: 'reset_password'; password: string } | { action: 'set_active'; active: boolean }),
    ) => {
      const { error } = await supabase.functions.invoke('manage-staff-login', { body: input });
      if (error) throw await functionError(error);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.team(businessId) }),
  });
}

export function useUpdateBranch(branchId: string) {
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.rpc('update_branch', { p_branch: branchId, p: asJson(patch) });
      if (error) throw error;
    },
  });
}

export function useSetBranchMode(branchId: string) {
  return useMutation({
    mutationFn: async (mode: 'gents' | 'ladies') => {
      const { error } = await supabase.rpc('set_branch_mode', { p_branch: branchId, p_mode: mode });
      if (error) throw error;
    },
  });
}

export function useSetOpeningCash(branchId: string) {
  return useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await supabase.rpc('set_opening_cash', { p_branch: branchId, p_amount: amount });
      if (error) throw error;
    },
  });
}
