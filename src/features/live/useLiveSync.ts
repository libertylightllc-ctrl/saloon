/**
 * Keeps every signed-in device in step. The database announces "table X changed" on private broadcast topics
 * (migration …019): branch:<id>, business:<id>, member:<member id>, and owners:<business id> for the owner and
 * accountant. Each announcement invalidates the queries that table feeds, so a walk-in added on one phone appears
 * on the other within a second or two. (One topic per scope instead of one subscription per table: ~35
 * postgres_changes subscriptions per phone made the realtime server miss events.)
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
  notifications: (memberId: string) => ['notifications', memberId] as const,
};

export function useLiveSync(businessId: string, branchId: string, memberId: string, seesOwnerTopics: boolean) {
  const client = useQueryClient();

  useEffect(() => {
    // What each table's change makes stale.
    const affected: Record<string, Key[]> = {
      appointments: [keys.appointments(branchId), keys.dashboard(branchId), keys.customers(businessId), keys.closing(branchId)],
      sales: [keys.sales(branchId), ['sale'], keys.dashboard(branchId), keys.customers(businessId), keys.closing(branchId), ['reports', branchId]],
      refunds: [keys.sales(branchId), ['sale'], keys.dashboard(branchId), keys.closing(branchId), ['reports', branchId]],
      stock_levels: [keys.stock(branchId), keys.catalog(businessId), ['reports', branchId]],
      stock_counts: [keys.stock(branchId), keys.dashboard(branchId), ['accounts', businessId], ['reports', branchId]],
      inventory_items: [keys.stock(branchId), keys.catalog(businessId), keys.dashboard(branchId), ['reports', branchId]],
      services: [keys.catalog(businessId)],
      service_categories: [keys.catalog(businessId)],
      customers: [keys.customers(businessId), ['reports', branchId]],
      members: [keys.team(businessId)],
      employees: [keys.team(businessId), keys.dashboard(branchId)],
      expenses: [keys.moneyOut(businessId), keys.dashboard(branchId), keys.closing(branchId), ['accounts', businessId], ['reports', branchId]],
      supplier_payments: [keys.moneyOut(businessId), keys.dashboard(branchId), keys.closing(branchId), ['accounts', businessId], ['reports', branchId]],
      purchase_bills: [keys.moneyOut(businessId), keys.stock(branchId), ['accounts', businessId], ['reports', branchId]],
      suppliers: [keys.moneyOut(businessId)],
      expense_categories: [keys.moneyOut(businessId)],
      cash_closings: [keys.closing(branchId), keys.dashboard(branchId), ['accounts', businessId], ['reports', branchId]],
      tip_payouts: [keys.closing(branchId), keys.dashboard(branchId), ['accounts', businessId], ['reports', branchId]],
      attendance: [keys.attendance(branchId), keys.dashboard(branchId), ['attendance-history'], ['reports', branchId]],
      attendance_breaks: [keys.attendance(branchId), keys.dashboard(branchId), ['attendance-history']],
      rosters: [keys.attendance(branchId), keys.team(businessId)],
      payroll_runs: [keys.payroll(businessId), keys.dashboard(branchId)],
      payroll_lines: [keys.payroll(businessId), keys.closing(branchId)],
      payroll_adjustments: [keys.payroll(businessId), keys.closing(branchId)],
      compliance_documents: [keys.compliance(businessId), keys.dashboard(branchId), ['reports', branchId]],
      hygiene_logs: [keys.hygiene(branchId), keys.dashboard(branchId)],
      refund_requests: [['refund-request']],
      notifications: [keys.notifications(memberId)],
      periods: [['accounts', businessId]],
      subscriptions: [['plan', businessId]],
    };
    const onChange = ({ payload }: { payload: { table?: string } }) => {
      for (const queryKey of affected[payload.table ?? ''] ?? []) void client.invalidateQueries({ queryKey });
    };
    const topics = [`branch:${branchId}`, `business:${businessId}`, `member:${memberId}`];
    if (seesOwnerTopics) topics.push(`owners:${businessId}`);
    const channels = topics.map((topic) => {
      // Rejoining after sleep or a dropped connection: anything that changed meanwhile sent no event.
      let joined = false;
      return supabase
        .channel(topic, { config: { private: true } })
        .on('broadcast', { event: 'change' }, onChange)
        .subscribe((state) => {
          if (state !== 'SUBSCRIBED') return;
          if (joined) void client.invalidateQueries();
          joined = true;
        });
    });
    return () => {
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [client, businessId, branchId, memberId, seesOwnerTopics]);
}
