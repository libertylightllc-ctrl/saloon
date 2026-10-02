/**
 * "Continue with Google" (docs/06). The button shows only when Google is switched on in Supabase
 * (Authentication → Providers → Google), read from the public auth settings.
 * Web: the page goes to Google and comes back with the session in the address (detectSessionInUrl).
 * Phones: Google opens in an in-app browser and returns to saloqo://auth-callback.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { AppError } from '@/lib/errors';
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';

export function useGoogleEnabled() {
  return useQuery({
    queryKey: ['auth-settings'],
    queryFn: async () => {
      const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseAnonKey } });
      if (!res.ok) return false;
      const body = (await res.json()) as { external?: Record<string, boolean> };
      return body.external?.google === true;
    },
    staleTime: 10 * 60_000,
    retry: false,
  });
}

/** Reads the tokens Supabase puts after "#" (or "?") on the way back from Google. */
export function tokensFrom(url: string): { access_token: string; refresh_token: string } | null {
  const part = url.includes('#') ? url.slice(url.indexOf('#') + 1) : url.slice(url.indexOf('?') + 1);
  const params = new URLSearchParams(part);
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  return access && refresh ? { access_token: access, refresh_token: refresh } : null;
}

async function signInWithGoogle(): Promise<void> {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
    return;
  }
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // closed by the person: nothing to do
  const tokens = tokensFrom(result.url);
  if (!tokens) throw new AppError('unknown');
  const { error: sessionError } = await supabase.auth.setSession(tokens);
  if (sessionError) throw sessionError;
}

export function useGoogleSignIn() {
  return useMutation({ mutationFn: signInWithGoogle });
}
