/** The owner's controls for a branch (brief B3): limits for discounts and petty cash, cash differences, blind count. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface Controls {
  discount_limit_bps: number;
  petty_cash_limit_minor: number;
  cash_reason_minor: number;
  cash_notify_minor: number;
  blind_count: boolean;
  staff_can_sell: boolean;
  staff_see_phones: boolean;
  staff_book_self: boolean;
}

export const controlsKey = (branchId: string) => ['controls', branchId] as const;

/** The branch's controls: the brief's defaults with the owner's choices on top. Everyone in the branch reads them. */
export function useControls(branchId: string) {
  return useQuery({
    queryKey: controlsKey(branchId),
    queryFn: async (): Promise<Controls> => {
      const { data, error } = await supabase.rpc('branch_controls', { p_branch: branchId });
      if (error) throw error;
      const c = data as unknown as Controls;
      return {
        ...c,
        discount_limit_bps: Number(c.discount_limit_bps),
        petty_cash_limit_minor: Number(c.petty_cash_limit_minor),
        cash_reason_minor: Number(c.cash_reason_minor),
        cash_notify_minor: Number(c.cash_notify_minor),
      };
    },
  });
}

/** The owner saves changed controls; each change is a line in the audit trail. */
export function useSaveControls(branchId: string, onSaved?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (changes: Partial<Controls>) => {
      const { error } = await supabase.rpc('save_controls', { p_branch: branchId, p: changes });
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: controlsKey(branchId) });
      onSaved?.();
    },
  });
}
