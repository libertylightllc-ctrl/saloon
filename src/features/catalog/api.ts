import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { Tables } from '@/lib/database.types';
import { asJson, supabase } from '@/lib/supabase';

export type Category = Tables<'service_categories'>;
export type InventoryItem = Pick<Tables<'inventory_items'>, 'id' | 'name' | 'unit'>;
export interface RecipeLine {
  item_id: string;
  qty: number;
  name: string;
  unit: string;
}
export type Service = Tables<'services'> & { recipe: RecipeLine[] };

export interface Catalog {
  categories: Category[];
  services: Service[];
  items: InventoryItem[];
}

export function useCatalog(businessId: string) {
  return useQuery({
    queryKey: keys.catalog(businessId),
    queryFn: async (): Promise<Catalog> => {
      const [categories, services, items] = await Promise.all([
        supabase.from('service_categories').select('*').eq('business_id', businessId).eq('archived', false).order('sort'),
        supabase
          .from('services')
          .select('*, service_recipe_items(qty, item_id, inventory_items(name, unit))')
          .eq('business_id', businessId)
          .order('name'),
        supabase.from('inventory_items').select('id, name, unit').eq('business_id', businessId).eq('active', true).order('name'),
      ]);
      for (const r of [categories, services, items]) if (r.error) throw r.error;
      return {
        categories: categories.data ?? [],
        items: items.data ?? [],
        services: (services.data ?? []).map(({ service_recipe_items, ...s }) => ({
          ...s,
          recipe: (service_recipe_items ?? []).map((r) => ({
            item_id: r.item_id,
            qty: Number(r.qty),
            name: r.inventory_items?.name ?? '',
            unit: r.inventory_items?.unit ?? 'pcs',
          })),
        })),
      };
    },
  });
}

export interface ServiceInput {
  id?: string;
  category_id: string;
  name: string;
  price_minor: number;
  duration_min: number;
  buffer_min: number;
  requires_room: boolean;
  requires_patch_test: boolean;
  status?: 'active' | 'archived';
  /** Existing item by id, or a new item by name + unit (created on save). */
  recipe: { item_id?: string; item_name?: string; unit?: string; qty: number }[];
}

export function useSaveService(businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: ServiceInput) => {
      const { data, error } = await supabase.rpc('save_service', { p: asJson({ ...input, business_id: businessId }) });
      if (error) throw error;
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.catalog(businessId) }),
  });
}

export function useSaveCategory(businessId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; icon: string; sort?: number; archived?: boolean }) => {
      const { error } = input.id
        ? await supabase
            .from('service_categories')
            .update({ name: input.name.trim(), icon: input.icon, archived: input.archived ?? false })
            .eq('id', input.id)
        : await supabase
            .from('service_categories')
            .insert({ business_id: businessId, name: input.name.trim(), icon: input.icon, sort: input.sort ?? 99 });
      if (error) throw error.code === '23505' ? new Error('category_exists') : error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.catalog(businessId) }),
  });
}
