/** My notifications (row security gives only mine), unread count, mark read, and refund requests. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import { asJson, supabase } from '@/lib/supabase';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface RefundRequest {
  id: string;
  amount_minor: number;
  reason: string;
  status: 'open' | 'done' | 'dismissed';
  created_at: string;
  members: { display_name: string } | null;
}

export function useNotifications(memberId: string) {
  return useQuery({
    queryKey: [...keys.notifications(memberId), 'list'],
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, data, entity_type, entity_id, read_at, created_at')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as AppNotification[];
    },
  });
}

export function useUnreadCount(memberId: string) {
  return useQuery({
    queryKey: [...keys.notifications(memberId), 'unread'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberId)
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkRead(memberId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[] | null) => {
      const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids ?? undefined });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.notifications(memberId) }),
  });
}

export function useRefundRequest(saleId: string) {
  return useQuery({
    queryKey: ['refund-request', saleId],
    queryFn: async (): Promise<RefundRequest | null> => {
      const { data, error } = await supabase
        .from('refund_requests')
        .select('id, amount_minor, reason, status, created_at, members!refund_requests_requested_by_fkey(display_name)')
        .eq('sale_id', saleId)
        .eq('status', 'open')
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RefundRequest | null;
    },
  });
}

export function useRequestRefund(saleId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { amount_minor: number; reason: string }) => {
      const { error } = await supabase.rpc('request_refund', { p: asJson({ ...input, sale_id: saleId }) });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['refund-request', saleId] }),
  });
}

export function useDismissRequest(saleId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; note: string | null }) => {
      const { error } = await supabase.rpc('dismiss_refund_request', { p_id: input.id, p_note: input.note ?? '' });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['refund-request', saleId] }),
  });
}
