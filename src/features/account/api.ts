import { useMutation } from '@tanstack/react-query';

import { functionError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/** Deletes the signed-in person's account on the server (the delete-account Edge Function). */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
      if (error) throw await functionError(error);
      return data as { ok: true; business_closed: boolean };
    },
  });
}
