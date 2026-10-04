/**
 * Currencies a salon can work in: minor-unit decimals (ISO 4217) and the notes and coins in circulation, for the cash
 * count. Amounts are always integers in minor units (rule 1); a currency with 3 decimals (KWD) counts in fils of 1/1000.
 */
export interface CurrencyInfo {
  decimals: 0 | 2 | 3;
  /** Notes and coins in major units, largest first. */
  notes: readonly number[];
  coins: readonly number[];
}

export const CURRENCIES = {
  AED: { decimals: 2, notes: [1000, 500, 200, 100, 50, 20, 10, 5], coins: [1, 0.5, 0.25] },
  SAR: { decimals: 2, notes: [500, 200, 100, 50, 10, 5], coins: [2, 1, 0.5, 0.25, 0.1, 0.05] },
  QAR: { decimals: 2, notes: [500, 200, 100, 50, 10, 5, 1], coins: [0.5, 0.25] },
  KWD: { decimals: 3, notes: [20, 10, 5, 1, 0.5, 0.25], coins: [0.1, 0.05, 0.02, 0.01, 0.005] },
  BHD: { decimals: 3, notes: [20, 10, 5, 1, 0.5], coins: [0.1, 0.05, 0.025, 0.01, 0.005] },
  OMR: { decimals: 3, notes: [50, 20, 10, 5, 1, 0.5, 0.1], coins: [0.05, 0.025, 0.01, 0.005] },
  EGP: { decimals: 2, notes: [200, 100, 50, 20, 10, 5], coins: [1, 0.5] },
  JOD: { decimals: 3, notes: [50, 20, 10, 5, 1], coins: [0.5, 0.25, 0.1, 0.05] },
  MAD: { decimals: 2, notes: [200, 100, 50, 20], coins: [10, 5, 2, 1, 0.5] },
  TND: { decimals: 3, notes: [50, 20, 10, 5], coins: [5, 2, 1, 0.5, 0.2, 0.1] },
  TRY: { decimals: 2, notes: [200, 100, 50, 20, 10, 5], coins: [1, 0.5, 0.25, 0.1] },
  ZAR: { decimals: 2, notes: [200, 100, 50, 20, 10], coins: [5, 2, 1, 0.5, 0.2, 0.1] },
  NGN: { decimals: 2, notes: [1000, 500, 200, 100, 50, 20, 10, 5], coins: [] },
  KES: { decimals: 2, notes: [1000, 500, 200, 100, 50], coins: [20, 10, 5, 1] },
  GHS: { decimals: 2, notes: [200, 100, 50, 20, 10, 5, 2, 1], coins: [2, 1, 0.5, 0.2, 0.1] },
  INR: { decimals: 2, notes: [500, 200, 100, 50, 20, 10], coins: [20, 10, 5, 2, 1] },
  PKR: { decimals: 2, notes: [5000, 1000, 500, 100, 50, 20, 10], coins: [10, 5, 2, 1] },
  BDT: { decimals: 2, notes: [1000, 500, 200, 100, 50, 20, 10, 5, 2], coins: [5, 2, 1] },
  LKR: { decimals: 2, notes: [5000, 2000, 1000, 500, 100, 50, 20], coins: [10, 5, 2, 1] },
  NPR: { decimals: 2, notes: [1000, 500, 100, 50, 20, 10, 5], coins: [2, 1] },
  SGD: { decimals: 2, notes: [1000, 100, 50, 10, 5, 2], coins: [1, 0.5, 0.2, 0.1, 0.05] },
  MYR: { decimals: 2, notes: [100, 50, 20, 10, 5, 1], coins: [0.5, 0.2, 0.1, 0.05] },
  PHP: { decimals: 2, notes: [1000, 500, 200, 100, 50, 20], coins: [20, 10, 5, 1, 0.25] },
  IDR: { decimals: 2, notes: [100000, 50000, 20000, 10000, 5000, 2000, 1000], coins: [1000, 500, 200, 100] },
  THB: { decimals: 2, notes: [1000, 500, 100, 50, 20], coins: [10, 5, 2, 1, 0.5, 0.25] },
  VND: { decimals: 0, notes: [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000], coins: [] },
  JPY: { decimals: 0, notes: [10000, 5000, 2000, 1000], coins: [500, 100, 50, 10, 5, 1] },
  AUD: { decimals: 2, notes: [100, 50, 20, 10, 5], coins: [2, 1, 0.5, 0.2, 0.1, 0.05] },
  NZD: { decimals: 2, notes: [100, 50, 20, 10, 5], coins: [2, 1, 0.5, 0.2, 0.1] },
  GBP: { decimals: 2, notes: [50, 20, 10, 5], coins: [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01] },
  EUR: { decimals: 2, notes: [500, 200, 100, 50, 20, 10, 5], coins: [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01] },
  CHF: { decimals: 2, notes: [1000, 200, 100, 50, 20, 10], coins: [5, 2, 1, 0.5, 0.2, 0.1, 0.05] },
  SEK: { decimals: 2, notes: [1000, 500, 200, 100, 50, 20], coins: [10, 5, 2, 1] },
  NOK: { decimals: 2, notes: [1000, 500, 200, 100, 50], coins: [20, 10, 5, 1] },
  DKK: { decimals: 2, notes: [1000, 500, 200, 100, 50], coins: [20, 10, 5, 2, 1, 0.5] },
  PLN: { decimals: 2, notes: [500, 200, 100, 50, 20, 10], coins: [5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01] },
  USD: { decimals: 2, notes: [100, 50, 20, 10, 5, 2, 1], coins: [1, 0.5, 0.25, 0.1, 0.05, 0.01] },
  CAD: { decimals: 2, notes: [100, 50, 20, 10, 5], coins: [2, 1, 0.25, 0.1, 0.05] },
  MXN: { decimals: 2, notes: [1000, 500, 200, 100, 50, 20], coins: [20, 10, 5, 2, 1, 0.5] },
  BRL: { decimals: 2, notes: [200, 100, 50, 20, 10, 5, 2], coins: [1, 0.5, 0.25, 0.1, 0.05] },
  COP: { decimals: 2, notes: [100000, 50000, 20000, 10000, 5000, 2000], coins: [1000, 500, 200, 100, 50] },
  CLP: { decimals: 0, notes: [20000, 10000, 5000, 2000, 1000], coins: [500, 100, 50, 10] },
} as const satisfies Record<string, CurrencyInfo>;

export type CurrencyCode = keyof typeof CURRENCIES;

export function isCurrency(code: string): code is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code);
}

/** Notes then coins, in minor units, largest first (for the cash count). */
export function denominationsOf(code: CurrencyCode): { minor: number; coin: boolean }[] {
  const { decimals, notes, coins } = CURRENCIES[code];
  const scale = 10 ** decimals;
  const toMinor = (major: number) => Math.round(major * scale);
  return [
    ...notes.map((n) => ({ minor: toMinor(n), coin: false })),
    ...coins.map((c) => ({ minor: toMinor(c), coin: true })),
  ];
}
