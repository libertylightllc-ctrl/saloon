import type { AdminSalon } from '@/features/plan/api';

/**
 * Console → Salons' status filter (owner, 2026-11-08). The groups are the Overview's: Free includes free for good, and
 * a test salon is only under All and Test, as the Overview leaves test salons out of its groups.
 */
export const SALON_FILTERS = ['all', 'paid', 'free', 'pilot', 'ended', 'closed', 'test'] as const;
export type SalonFilter = (typeof SALON_FILTERS)[number];

export function inFilter(s: Pick<AdminSalon, 'business_id' | 'status'>, filter: SalonFilter, tests: ReadonlySet<string>): boolean {
  if (filter === 'all') return true;
  const test = tests.has(s.business_id);
  if (filter === 'test') return test;
  if (test) return false;
  return filter === 'free' ? s.status === 'free' || s.status === 'comp' : s.status === filter;
}
