/** Counting the drawer: UAE dirham notes and coins in fils, and how a count compares with expected. */
import { multiply, sum, type Minor } from '@/lib/money';

/** AED 1000 … 5 notes, then 1, 0.50 and 0.25 coins. */
export const AED_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25] as const;
export const COIN_FROM = 100;

export type Denominations = Record<string, number>;

/** Total of a denomination count; blank or bad entries count as zero. */
export function countTotal(counts: Denominations): Minor {
  return sum(
    AED_DENOMINATIONS.map((value) => {
      const n = counts[String(value)] ?? 0;
      return Number.isInteger(n) && n > 0 ? multiply(value, n) : 0;
    }),
  );
}

/** Only the denominations actually counted, for storing with the close. */
export function compact(counts: Denominations): Denominations {
  return Object.fromEntries(Object.entries(counts).filter(([, n]) => Number.isInteger(n) && n > 0));
}

export type VarianceKind = 'short' | 'over' | 'balanced';

export function varianceKind(counted: Minor, expected: Minor): VarianceKind {
  if (counted < expected) return 'short';
  if (counted > expected) return 'over';
  return 'balanced';
}
