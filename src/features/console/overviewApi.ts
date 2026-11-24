/**
 * The Overview's business numbers (owner's brief, Part B, 24 Nov 2026): each card reads its own function, which checks
 * the caller is a platform owner, so a slow or failing card leaves the others showing.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import type { FxRates } from './fx';

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
