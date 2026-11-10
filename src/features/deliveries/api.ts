/**
 * Deliveries (brief B2 "Order stock, receive a delivery"): the front desk records what arrived, without prices; the
 * owner, a manager or the accountant adds the prices from the supplier's invoice, which makes it the supplier bill
 * and only then puts it in stock. A waiting delivery can be cancelled with a reason, never deleted.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import { asJson, supabase } from '@/lib/supabase';
import type { BusinessDate } from '@/lib/dates';

export type DeliveryStatus = 'waiting' | 'priced' | 'cancelled';

export interface DeliveryLine {
  id: string;
  item_id: string;
  packs: number;
  pack_size: number | null;
  sort: number;
  inventory_items: { name: string; unit: string; pack_size: number | null } | null;
}

export interface Delivery {
  id: string;
  number: number;
  status: DeliveryStatus;
  business_date: BusinessDate;
  supplier_id: string | null;
  supplier_name: string | null;
  suppliers: { name: string } | null;
  note: string | null;
  note_path: string | null;
  received_by: string | null;
  received_name: string;
  received_at: string;
  bill_id: string | null;
  priced_at: string | null;
  cancel_reason: string | null;
  delivery_lines: DeliveryLine[];
}

const SELECT =
  'id, number, status, business_date, supplier_id, supplier_name, suppliers(name), note, note_path, received_by, ' +
  'received_name, received_at, bill_id, priced_at, cancel_reason, ' +
  'delivery_lines(id, item_id, packs, pack_size, sort, inventory_items(name, unit, pack_size))';

const deliveriesKey = (branchId: string) => [...keys.stock(branchId), 'deliveries'] as const;

/** The supplier as recorded: one from the list, or the name typed at the door. */
export const supplierOf = (d: Pick<Delivery, 'suppliers' | 'supplier_name'>) => d.suppliers?.name ?? d.supplier_name ?? null;

/** Waiting deliveries first (oldest first, to be priced in order), then the last 30 days of priced and cancelled. */
export function useDeliveries(branchId: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: deliveriesKey(branchId),
    queryFn: async (): Promise<Delivery[]> => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('deliveries')
        .select(SELECT)
        .eq('branch_id', branchId)
        .or(`status.eq.waiting,received_at.gte.${since}`)
        .order('received_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Delivery[];
      const waiting = rows.filter((d) => d.status === 'waiting').reverse();
      return [...waiting, ...rows.filter((d) => d.status !== 'waiting')].map(sortLines);
    },
  });
}

export function useDelivery(branchId: string, id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: [...deliveriesKey(branchId), id],
    queryFn: async (): Promise<Delivery> => {
      const { data, error } = await supabase.from('deliveries').select(SELECT).eq('id', id!).single();
      if (error) throw error;
      return sortLines(data as unknown as Delivery);
    },
  });
}

const sortLines = (d: Delivery): Delivery => ({ ...d, delivery_lines: [...d.delivery_lines].sort((a, b) => a.sort - b.sort) });

function useDone(businessId: string, branchId: string) {
  const client = useQueryClient();
  return () => {
    for (const queryKey of [keys.stock(branchId), keys.moneyOut(businessId), keys.dashboard(branchId), ['accounts', businessId], ['notifications']]) {
      void client.invalidateQueries({ queryKey });
    }
  };
}

export interface ReceiveInput {
  supplier_id: string | null;
  supplier_name: string | null;
  note: string | null;
  note_path: string | null;
  client_ref: string;
  lines: { item_id: string; packs: number; pack_size?: number }[];
}

export function useReceiveDelivery(businessId: string, branchId: string) {
  const done = useDone(businessId, branchId);
  return useMutation({
    mutationFn: async (input: ReceiveInput) => {
      const { data, error } = await supabase.rpc('receive_delivery', { p: asJson({ ...input, branch_id: branchId }) });
      if (error) throw error;
      return data as { delivery_id: string; number: number; repeated: boolean };
    },
    onSuccess: done,
  });
}

export interface PriceInput {
  delivery_id: string;
  supplier_id: string;
  invoice_ref: string | null;
  bill_date: BusinessDate;
  lines: { line_id: string; unit_price_minor: number; vat_minor: number; pack_size?: number }[];
}

export function usePriceDelivery(businessId: string, branchId: string) {
  const done = useDone(businessId, branchId);
  return useMutation({
    mutationFn: async (input: PriceInput) => {
      const { data, error } = await supabase.rpc('price_delivery', { p: asJson(input) });
      if (error) throw error;
      return data as { bill_id: string; number: number; total_minor: number };
    },
    onSuccess: done,
  });
}

export function useCancelDelivery(businessId: string, branchId: string) {
  const done = useDone(businessId, branchId);
  return useMutation({
    mutationFn: async (input: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('cancel_delivery', { p_delivery: input.id, p_reason: input.reason });
      if (error) throw error;
    },
    onSuccess: done,
  });
}
