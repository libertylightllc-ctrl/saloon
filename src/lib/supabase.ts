import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import type { Database, Json } from './database.types';

const LOCAL_API_PORT = 54321;

/**
 * EXPO_PUBLIC_SUPABASE_URL is either a full URL (hosted project) or "auto": use the machine that
 * serves the app. On a phone that is the Mac's network IP from the Expo dev server, on web the
 * page's host — so the local database works without hard-coding an IP that changes.
 */
export function resolveSupabaseUrl(
  configured: string | undefined,
  hostUri: string | undefined,
  webHost: string | undefined,
): string | null {
  const value = configured?.trim();
  if (value && value !== 'auto') return value.replace(/\/$/, '');
  const host = webHost || hostUri?.split(':')[0];
  return host ? `http://${host}:${LOCAL_API_PORT}` : null;
}

/** This computer or the local network — where the Mac's local database (`npx supabase start`) is reachable. */
export function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  );
}

/**
 * Is there a database to talk to? "auto" (or nothing) only works next to the local stack; a site on
 * a public address needs a hosted project URL. Without one the app shows "being set up" instead of
 * a sign-in that cannot work.
 */
export function hasBackend(configured: string | undefined, anonKey: string | undefined, webHost: string | undefined): boolean {
  if (!anonKey?.trim()) return false;
  const value = configured?.trim();
  if (value && value !== 'auto') return true;
  return !webHost || isLocalHost(webHost);
}

const webHost = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : undefined;
const url = resolveSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL, Constants.expoConfig?.hostUri, webHost);
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const backendReady = Boolean(url) && hasBackend(process.env.EXPO_PUBLIC_SUPABASE_URL, anonKey, webHost);
export const supabaseUrl = url ?? 'http://127.0.0.1:54321';
export const supabaseAnonKey = anonKey ?? 'missing-anon-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground (Supabase guidance for React Native).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/**
 * A client that keeps its session in memory only — for steps that must not sign this device in
 * until they have fully succeeded (password reset).
 */
export function detachedClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-detached' },
  });
}

/** RPC payloads are typed as Json; our input interfaces are plain JSON already. */
export function asJson<T>(value: T): Json {
  return value as unknown as Json;
}
