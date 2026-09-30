/**
 * Inventory & tools. Levels and values come from inventory_levels() (costs only for the front desk);
 * every change is one RPC that writes the movement, the level and the journal entry.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import { asJson, supabase } from '@/lib/supabase';

export type ItemKind = 'consumable' | 'retail' | 'tool';
export type ItemUnit = 'pcs' | 'ml' | 'g' | 'pairs';

export interface StockItem {
  item_id: string;
  name: string;
  kind: ItemKind;
  unit: ItemUnit;
  location: string | null;
  reorder_level: number;
  qty: number;
  low: boolean;
  avg_unit_cost_minor: number | null;
  value_minor: number | null;
  sell_price_minor: number | null;
  condition: 'good' | 'needs_service' | null;
  next_service_date: string | null;
  assigned_to: string | null;
  montaji_reg_no: string | null;
  active: boolean;
  movements_30d: number;
  last_movement_at: string | null;
}

export interface Movement {
  id: string;
  qty_delta: number;
  reason: 'purchase' | 'service_use' | 'retail_sale' | 'adjustment' | 'count' | 'reversal' | 'opening';
  unit_cost_minor: number;
  ref_type: string | null;
  note: string | null;
  created_at: string;
  members: { display_name: string } | null;
}

export function useInventory(branchId: string) {
  return useQuery({
    queryKey: [...keys.stock(branchId), 'levels'],
    queryFn: async (): Promise<StockItem[]> => {
      const { data, error } = await supabase.rpc('inventory_levels', { p_branch: branchId });
      if (error) throw error;
      return (data ?? []).map((i) => ({
        ...i,
        kind: i.kind as ItemKind,
        unit: i.unit as ItemUnit,
        condition: i.condition as StockItem['condition'],
        reorder_level: Number(i.reorder_level),
        qty: Number(i.qty),
        avg_unit_cost_minor: i.avg_unit_cost_minor === null ? null : Number(i.avg_unit_cost_minor),
        value_minor: i.value_minor === null ? null : Number(i.value_minor),
      }));
    },
  });
}

/** Front desk only (row level security); newest first. */
export function useMovements(branchId: string, itemId: string | undefined, enabled: boolean) {
  return useQuery({
    enabled: Boolean(itemId) && enabled,
    queryKey: [...keys.stock(branchId), 'movements', itemId],
    queryFn: async (): Promise<Movement[]> => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, qty_delta, reason, unit_cost_minor, ref_type, note, created_at, members!stock_movements_created_by_fkey(display_name)')
        .eq('branch_id', branchId)
        .eq('item_id', itemId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((m) => ({ ...m, qty_delta: Number(m.qty_delta), unit_cost_minor: Number(m.unit_cost_minor) })) as Movement[];
    },
  });
}

function useInvalidateStock(branchId: string, businessId: string) {
  const client = useQueryClient();
  return () => {
    for (const queryKey of [keys.stock(branchId), keys.catalog(businessId), keys.dashboard(branchId), ['accounts', businessId]]) {
      void client.invalidateQueries({ queryKey });
    }
  };
}

export interface ItemInput {
  id?: string;
  name: string;
  kind: ItemKind;
  unit: ItemUnit;
  reorder_level: number;
  sell_price_minor: number | null;
  location: string | null;
  condition: 'good' | 'needs_service' | null;
  next_service_date: string | null;
  assigned_to: string | null;
  montaji_reg_no: string | null;
  /** What one pack or bottle holds, in the item's unit (1 L bottle = 1000 ml); purchase bills start from it. */
  pack_size?: number;
  active?: boolean;
}

/** The item's usual pack size (not part of inventory_levels()). */
export function useItemPackSize(businessId: string, itemId: string | undefined) {
  return useQuery({
    enabled: Boolean(itemId),
    queryKey: [...keys.catalog(businessId), 'pack', itemId],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.from('inventory_items').select('pack_size').eq('id', itemId!).single();
      if (error) throw error;
      return Number(data.pack_size);
    },
  });
}

export function useSaveItem(branchId: string, businessId: string) {
  const done = useInvalidateStock(branchId, businessId);
  return useMutation({
    mutationFn: async (input: ItemInput) => {
      const { data, error } = await supabase.rpc('save_item', { p: asJson({ ...input, business_id: businessId }) });
      if (error) throw error;
      return data as string;
    },
    onSuccess: done,
  });
}

export function useAdjustStock(branchId: string, businessId: string) {
  const done = useInvalidateStock(branchId, businessId);
  return useMutation({
    mutationFn: async (input: { item_id: string; qty_delta: number; reason: string; client_ref: string }) => {
      const { data, error } = await supabase.rpc('adjust_stock', { p: asJson({ ...input, branch_id: branchId }) });
      if (error) throw error;
      return data as { value_change_minor: number };
    },
    onSuccess: done,
  });
}

export function useRecordCount(branchId: string, businessId: string) {
  const done = useInvalidateStock(branchId, businessId);
  return useMutation({
    mutationFn: async (input: { counts: { item_id: string; counted_qty: number }[]; note: string | null; client_ref: string }) => {
      const { data, error } = await supabase.rpc('record_stock_count', { p: asJson({ ...input, branch_id: branchId }) });
      if (error) throw error;
      return data as { items_changed: number; value_change_minor: number };
    },
    onSuccess: done,
  });
}

/** Opening stock at its cost (Dr Inventory · Cr Owner equity). Owner. */
export function useOpeningStock(branchId: string, businessId: string) {
  const done = useInvalidateStock(branchId, businessId);
  return useMutation({
    mutationFn: async (input: { items: { item_id: string; qty: number; unit_cost_minor: number }[] }) => {
      const { error } = await supabase.rpc('set_opening_stock', { p_branch: branchId, p_items: asJson(input.items) });
      if (error) throw error;
    },
    onSuccess: done,
  });
}
