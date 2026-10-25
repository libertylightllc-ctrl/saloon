/** A salon's branches (full update, Phase 6 f): the list, adding one (owner) and opening another. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';
import { planKey } from '@/features/plan/api';
import { supabase } from '@/lib/supabase';
import type { Mode } from '@/theme';

export interface BranchRow {
  id: string;
  name: string;
  mode: Mode;
  address: string | null;
}

const branchesKey = (businessId: string) => ['branches', businessId] as const;

export function useBranches(businessId: string) {
  return useQuery({
    queryKey: branchesKey(businessId),
    queryFn: async (): Promise<BranchRow[]> => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, mode, address')
        .eq('business_id', businessId)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as BranchRow[];
    },
  });
}

export interface NewBranch {
  name: string;
  mode: Mode;
  address: string;
  phone: string;
}

/** Owner only (the server checks): the first branch's settings, a stock line per item, its own sale numbers. */
export function useCreateBranch(businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: NewBranch) => {
      const { data, error } = await supabase.rpc('create_branch', { p: { business_id: businessId, ...v } });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: branchesKey(businessId) });
      void client.invalidateQueries({ queryKey: planKey(businessId) });
    },
  });
}

/** Opens another branch the person works at: the whole app follows it (the session's branch). */
export function useSwitchBranch() {
  const { reload } = useSession();
  return useMutation({
    mutationFn: async (branchId: string) => {
      const { error } = await supabase.rpc('set_my_branch', { p_branch: branchId });
      if (error) throw error;
      await reload();
    },
  });
}
