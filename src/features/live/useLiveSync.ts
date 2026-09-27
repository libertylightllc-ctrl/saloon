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
  closing: (branchId: string) => ['closing', branchId] as const,
  attendance: (branchId: string) => ['attendance', branchId] as const,
  payroll: (businessId: string) => ['payroll', businessId] as const,
  compliance: (businessId: string) => ['compliance', businessId] as const,
  hygiene: (branchId: string) => ['hygiene', branchId] as const,
};

export function useLiveSync(businessId: string, branchId: string) {
  const client = useQueryClient();

  useEffect(() => {
    const invalidate = (...targets: Key[]) => () => {
      for (const queryKey of targets) void client.invalidateQueries({ queryKey });
    };
    const branchFilter = `branch_id=eq.${branchId}`;
    // Rejoining after sleep or a dropped connection: anything that changed meanwhile sent no event.
    let joined = false;
    const businessFilter = `business_id=eq.${businessId}`;
    const channel = supabase
      .channel(`live-${branchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: branchFilter },
        invalidate(keys.appointments(branchId), keys.dashboard(branchId), keys.customers(businessId), keys.closing(branchId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: branchFilter },
        invalidate(keys.sales(branchId), ['sale'], keys.dashboard(branchId), keys.customers(businessId), keys.closing(branchId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds', filter: branchFilter },
        invalidate(keys.sales(branchId), ['sale'], keys.dashboard(branchId), keys.closing(branchId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_levels', filter: branchFilter },
        invalidate(keys.stock(branchId), keys.catalog(businessId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items', filter: businessFilter },
        invalidate(keys.stock(branchId), keys.catalog(businessId), keys.dashboard(branchId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_counts', filter: branchFilter },
        invalidate(keys.stock(branchId), keys.dashboard(branchId), ['accounts', businessId]))
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
        invalidate(keys.moneyOut(businessId), keys.dashboard(branchId), keys.closing(branchId), ['accounts', businessId]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: branchFilter },
        invalidate(keys.attendance(branchId), keys.dashboard(branchId), ['attendance-history']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_runs', filter: businessFilter },
        invalidate(keys.payroll(businessId), keys.dashboard(branchId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_lines', filter: businessFilter },
        invalidate(keys.payroll(businessId), keys.closing(branchId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_adjustments', filter: businessFilter },
        invalidate(keys.payroll(businessId), keys.closing(branchId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compliance_documents', filter: businessFilter },
        invalidate(keys.compliance(businessId), keys.dashboard(branchId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hygiene_logs', filter: branchFilter },
        invalidate(keys.hygiene(branchId), keys.dashboard(branchId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rosters', filter: businessFilter },
        invalidate(keys.attendance(branchId), keys.team(businessId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_closings', filter: branchFilter },
        invalidate(keys.closing(branchId), keys.dashboard(branchId), ['accounts', businessId]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tip_payouts', filter: branchFilter },
        invalidate(keys.closing(branchId), keys.dashboard(branchId), ['accounts', businessId]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_payments', filter: branchFilter },
        invalidate(keys.moneyOut(businessId), keys.dashboard(branchId), keys.closing(branchId), ['accounts', businessId]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_bills', filter: businessFilter },
        invalidate(keys.moneyOut(businessId), keys.stock(branchId), ['accounts', businessId]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers', filter: businessFilter },
        invalidate(keys.moneyOut(businessId)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_categories', filter: businessFilter },
        invalidate(keys.moneyOut(businessId)))
      .subscribe((state) => {
        if (state !== 'SUBSCRIBED') return;
        if (joined) void client.invalidateQueries();
        joined = true;
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client, businessId, branchId]);
}
