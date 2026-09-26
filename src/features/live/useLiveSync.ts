/**
 * Keeps every signed-in device in step: one Realtime channel per branch invalidates the queries a
 * change affects, so a walk-in added on one phone appears on the other within a second or two.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

type Key = readonly unknown[];

export const keys = {
  dashboard: (branchId: string) => ['dashboard', branchId] as const,
  appointments: (branchId: string) => ['appointments', branchId] as const,
  sales: (branchId: string) => ['sales', branchId] as const,
  sale: (saleId: string) => ['sale', saleId] as const,
  catalog: (businessId: string) => ['catalog', businessId] as const,
  customers: (businessId: string) => ['customers', businessId] as const,
  team: (businessId: string) => ['team', businessId] as const,
  stock: (branchId: string) => ['stock', branchId] as const,
  rooms: (branchId: string) => ['rooms', branchId] as const,
  moneyOut: (businessId: string) => ['moneyout', businessId] as const,
};

export function useLiveSync(businessId: string, branchId: string) {
  const client = useQueryClient();

  useEffect(() => {
    const invalidate = (...targets: Key[]) => () => {
      for (const queryKey of targets) void client.invalidateQueries({ queryKey });
    };
    const branchFilter = `branch_id=eq.${branchId}`;
    const businessFilter = `business_id=eq.${businessId}`;
    const channel = supabase
      .channel(`live-${branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: branchFilter },
        invalidate(keys.appointments(branchId), keys.dashboard(branchId), keys.customers(businessId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: branchFilter },
        invalidate(keys.sales(branchId), ['sale'], keys.dashboard(branchId), keys.customers(businessId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds', filter: branchFilter },
        invalidate(keys.sales(branchId), ['sale'], keys.dashboard(branchId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_levels', filter: branchFilter },
        invalidate(keys.stock(branchId), keys.catalog(businessId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services', filter: businessFilter },
        invalidate(keys.catalog(businessId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_categories', filter: businessFilter },
        invalidate(keys.catalog(businessId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: businessFilter },
        invalidate(keys.customers(businessId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: businessFilter },
        invalidate(keys.team(businessId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees', filter: businessFilter },
        invalidate(keys.team(businessId), keys.dashboard(branchId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: branchFilter },
        invalidate(keys.moneyOut(businessId), keys.dashboard(branchId), ['accounts', businessId]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_payments', filter: branchFilter },
        invalidate(keys.moneyOut(businessId), keys.dashboard(branchId), ['accounts', businessId]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_bills', filter: businessFilter },
        invalidate(keys.moneyOut(businessId), keys.stock(branchId), ['accounts', businessId]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers', filter: businessFilter },
        invalidate(keys.moneyOut(businessId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_categories', filter: businessFilter },
        invalidate(keys.moneyOut(businessId)))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client, businessId, branchId]);
}
