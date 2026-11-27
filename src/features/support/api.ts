/**
 * Help & support chat (owner, 2026-10-12): a signed-in person's conversation and a visitor's (known by a secret kept
 * on their device); the platform owners' inbox is in adminApi.ts. Each message carries where it came from — platform,
 * app version, language, the screen before Help, and the device — to help fix what went wrong.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { i18n } from '@/lib/i18n';
import { asJson, supabase } from '@/lib/supabase';

import { lastScreen } from './lastScreen';

export interface SupportMessage {
  id: string;
  author: 'user' | 'support' | 'assistant';
  body: string;
  created_at: string;
  /** Where a person from the team answered: in the app, or on WhatsApp (console brief E3). */
  channel?: 'app' | 'whatsapp';
}

export interface SupportThread {
  id: string | null;
  status: 'open' | 'closed';
  name?: string | null;
  email?: string | null;
  messages: SupportMessage[];
}

const supportKey = ['support'] as const;
// While the chat is open, answers show up within a few seconds.
const POLL_MS = 8_000;

function context() {
  const web = Platform.OS === 'web' && typeof navigator !== 'undefined';
  return {
    platform: Platform.OS,
    version: Constants.expoConfig?.version ?? '',
    language: i18n.language,
    screen: lastScreen() ?? '',
    device: web ? navigator.userAgent : `${Platform.OS} ${String(Platform.Version)}`,
  };
}

// ── Signed in ──────────────────────────────────────────────────────────────────────────

export function useSupportMine() {
  const client = useQueryClient();
  return useQuery({
    queryKey: [...supportKey, 'mine'],
    queryFn: async (): Promise<SupportThread> => {
      const { data, error } = await supabase.rpc('support_mine');
      if (error) throw error;
      // Opening the chat reads the answers.
      void client.invalidateQueries({ queryKey: [...supportKey, 'unread'] });
      return data as unknown as SupportThread;
    },
    refetchInterval: POLL_MS,
  });
}

export function useSupportUnread(enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...supportKey, 'unread'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('support_unread');
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

export function useSupportSend() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.rpc('support_send', {
        p: asJson({ body: body.trim(), context: context() }),
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: supportKey }),
  });
}

// ── Visitors ───────────────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'support.guestToken';

/** This device's secret for its visitor conversation (made on first use, kept on the device). */
export async function guestToken(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(TOKEN_KEY);
    if (stored && /^[A-Za-z0-9_-]{32,128}$/.test(stored)) return stored;
  } catch {
    // A device without storage still gets a conversation for this visit.
  }
  const token = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, '');
  await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => undefined);
  return token;
}

export function useGuestThread(token: string | null) {
  return useQuery({
    enabled: token !== null,
    queryKey: [...supportKey, 'guest', token],
    queryFn: async (): Promise<SupportThread> => {
      const { data, error } = await supabase.rpc('support_guest_thread', { p_token: token! });
      if (error) throw error;
      return data as unknown as SupportThread;
    },
    refetchInterval: POLL_MS,
  });
}

export function useGuestSend(token: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { body: string; name?: string; email?: string }) => {
      const { error } = await supabase.rpc('support_guest_send', {
        p: asJson({
          token,
          name: v.name?.trim(),
          email: v.email?.trim(),
          body: v.body.trim(),
          context: context(),
        }),
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: [...supportKey, 'guest', token] }),
  });
}
