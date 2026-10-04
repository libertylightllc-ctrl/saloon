/** Counting the drawer: the salon currency's notes and coins, and how a count compares with expected. */
import { denominationsOf, type CurrencyCode } from '@/lib/currencies';
import { activeCurrency, formatAmount, multiply, sum, type Minor } from '@/lib/money';

export interface Denomination {
  /** Key in a stored count: the value in minor units ("10000" = AED 100); "c2000" for a coin with the same value as a note. */
  key: string;
  minor: Minor;
  coin: boolean;
  /** "100", "0.25" (major units, no needless decimals). */
  label: string;
}

/** Notes then coins, largest first: AED 1000 … 5 notes, then 1, 0.50 and 0.25 coins. */
export function denominationsFor(currency: CurrencyCode = activeCurrency()): Denomination[] {
  const list = denominationsOf(currency);
  const noteValues = new Set(list.filter((d) => !d.coin).map((d) => d.minor));
  return list.map((d) => ({
    key: d.coin && noteValues.has(d.minor) ? `c${d.minor}` : String(d.minor),
    minor: d.minor,
    coin: d.coin,
    label: formatAmount(d.minor, currency).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''),
  }));
}

export type Denominations = Record<string, number>;

/** Total of a denomination count; blank or bad entries count as zero. */
export function countTotal(counts: Denominations, list: Denomination[] = denominationsFor()): Minor {
  return sum(
    list.map((d) => {
      const n = counts[d.key] ?? 0;
      return Number.isInteger(n) && n > 0 ? multiply(d.minor, n) : 0;
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
