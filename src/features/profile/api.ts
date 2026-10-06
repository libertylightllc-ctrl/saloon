/**
 * The signed-in person's own profile (owner, 2026-10-06): name and phone, the salon's name (owner), the sign-in email
 * (owner; confirmed from both inboxes) and the password (the current one is asked first).
 */
import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { useSession } from '@/features/auth/session';
import { AppError } from '@/lib/errors';
import { asJson, supabase } from '@/lib/supabase';

export function useUpdateProfile() {
  const { reload } = useSession();
  return useMutation({
    mutationFn: async (input: { display_name: string; phone: string }) => {
      const { error } = await supabase.rpc('update_my_profile', { p: asJson(input) });
      if (error) throw error;
    },
    onSuccess: () => reload(),
  });
}

export function useRenameBusiness(businessId: string) {
  const { reload } = useSession();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.rpc('rename_business', { p_business: businessId, p_name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => reload(),
  });
}

/** A new sign-in email: Supabase sends a confirmation to the old and the new address; it changes once both confirm. */
export function useChangeEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      const emailRedirectTo = Platform.OS === 'web' ? `${window.location.origin}/` : Linking.createURL('auth-callback');
      const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo });
      if (error) throw error;
    },
  });
}

/** The current password is checked first, so a phone left signed in cannot be used to take the account over. */
export function useChangePassword() {
  const { session } = useSession();
  return useMutation({
    mutationFn: async ({ current, next }: { current: string; next: string }) => {
      const email = session?.user.email;
      if (!email) throw new AppError('not_signed_in');
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) throw new AppError('wrong_current_password');
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
    },
  });
}
