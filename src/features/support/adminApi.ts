/**
 * The platform owners' support inbox in the console (2026-10-12), with the statuses of the console brief's Part E
 * (27 Nov 2026; migration 123): New, Waiting for you, Waiting for salon, Solved and Closed; and its reply tools
 * (Part E3, migration 124): saved replies, internal notes and answering on WhatsApp.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useIsPlatformAdmin } from '@/features/plan/api';
import { supabase } from '@/lib/supabase';

import type { SupportThread } from './api';
import type { Stage } from './stage';

// While a conversation is open in the console, new messages show up within a few seconds.
const POLL_MS = 8_000;
const inboxKey = ['platform', 'support'] as const;

export interface SupportThreadRow {
  id: string;
  status: 'open' | 'closed';
  created_at: string;
  last_message_at: string;
  last_from: 'user' | 'support' | 'assistant';
  unread: number;
  who: string | null;
  email: string | null;
  salon: string | null;
  salon_code: string | null;
  role: string | null;
  context: Record<string, string>;
  preview: string | null;
  /** A person has it: the assistant handed it over, or a platform owner answered or set its status. */
  handover: boolean;
  stage: Stage;
  /** When it got its status (for Waiting for you: since when). */
  stage_at: string;
  first_asked_at: string | null;
  /** The first answer by a person, in the app or on WhatsApp. */
  first_reply_at: string | null;
}

export function useSupportInbox() {
  return useQuery({
    queryKey: inboxKey,
    queryFn: async (): Promise<SupportThreadRow[]> => {
      const { data, error } = await supabase.rpc('admin_support_threads');
      if (error) throw error;
      return (data ?? []) as unknown as SupportThreadRow[];
    },
    refetchInterval: 30_000,
  });
}

/** Conversations waiting for a person, for the badges outside the console (platform owners only). */
export function useSupportWaiting(): number {
  const admin = useIsPlatformAdmin();
  const waiting = useQuery({
    queryKey: [...inboxKey, 'waiting'],
    enabled: admin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_support_waiting');
      if (error) throw error;
      return Number(data ?? 0);
    },
    refetchInterval: 2 * 60_000,
  });
  return admin.data === true ? (waiting.data ?? 0) : 0;
}

export interface SupportNote {
  id: string;
  author: string;
  body: string;
  created_at: string;
}

/** A conversation as the console sees it: with its internal notes, and the WhatsApp number when it is OK to use. */
export interface AdminSupportThread extends SupportThread {
  stage: Stage;
  whatsapp: string | null;
  notes: SupportNote[];
}

export function useSupportThreadAdmin(threadId: string | null) {
  const client = useQueryClient();
  return useQuery({
    enabled: threadId !== null,
    queryKey: [...inboxKey, threadId],
    queryFn: async (): Promise<AdminSupportThread> => {
      const { data, error } = await supabase.rpc('admin_support_thread', { p_thread: threadId! });
      if (error) throw error;
      void client.invalidateQueries({ queryKey: inboxKey, exact: true });
      return data as unknown as AdminSupportThread;
    },
    refetchInterval: POLL_MS,
  });
}

export function useSupportReply() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { thread: string; body: string }) => {
      const { error } = await supabase.rpc('admin_support_reply', {
        p_thread: v.thread,
        p_body: v.body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: inboxKey }),
  });
}

/** Waiting for you (take it back), Solved or Closed; a reason while nobody has answered the last message. */
export function useSupportSetStage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { thread: string; stage: 'waiting_team' | 'solved' | 'closed'; reason?: string }) => {
      const { error } = await supabase.rpc('admin_support_set_stage', {
        p_thread: v.thread,
        p_stage: v.stage,
        p_reason: v.reason?.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: inboxKey }),
  });
}

/** The answer is kept in the conversation (marked WhatsApp); the number comes back to open WhatsApp with it. */
export function useSupportWhatsApp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { thread: string; body: string }) => {
      const { data, error } = await supabase.rpc('admin_support_whatsapp', {
        p_thread: v.thread,
        p_body: v.body.trim(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: inboxKey }),
  });
}

/** An internal note: platform owners only, never shown to the person asking. */
export function useSupportNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { thread: string; body: string }) => {
      const { error } = await supabase.rpc('admin_support_add_note', { p_thread: v.thread, p_body: v.body.trim() });
      if (error) throw error;
    },
    onSuccess: (_d, v) => client.invalidateQueries({ queryKey: [...inboxKey, v.thread] }),
  });
}

export interface SavedReply {
  id: string;
  title: string;
  body: string;
  updated_at: string;
}
const savedKey = ['platform', 'saved-replies'] as const;

export function useSavedReplies() {
  return useQuery({
    queryKey: savedKey,
    queryFn: async (): Promise<SavedReply[]> => {
      const { data, error } = await supabase.rpc('admin_saved_replies');
      if (error) throw error;
      return (data ?? []) as unknown as SavedReply[];
    },
  });
}

/** Adds a saved reply, or changes one (with its id); either way written to Changes. */
export function useSaveReply() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id?: string; title: string; body: string }) => {
      const { error } = await supabase.rpc('admin_save_reply', {
        p_title: v.title.trim(),
        p_body: v.body.trim(),
        p_id: v.id,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: savedKey }),
  });
}

/** Hidden from the list (kept, and written to Changes). */
export function useRemoveSavedReply() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_remove_saved_reply', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: savedKey }),
  });
}

/** Whether the AI assistant answers new messages first (platform owners switch it). */
export function useSupportAssistant() {
  return useQuery({
    queryKey: ['platform', 'support-assistant'],
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_settings').select('support_assistant').single();
      if (error) throw error;
      return data.support_assistant;
    },
  });
}

export function useSetSupportAssistant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.rpc('admin_set_support_assistant', { p_on: on });
      if (error) throw error;
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['platform', 'support-assistant'] });
      // Switching it off moves what it was about to answer to Waiting for you.
      void client.invalidateQueries({ queryKey: inboxKey });
    },
  });
}
