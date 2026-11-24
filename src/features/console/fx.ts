import { CURRENCIES, isCurrency, type CurrencyCode } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';

/**
 * The Overview's reporting currency (owner's brief, Part B): amounts in other currencies are converted at the day's
 * rate and shown with "≈". The rates are how many of each currency one US dollar buys (ExchangeRate-API, and the
 * currencies fixed to the dollar). Display only: nothing converted is ever saved.
 */
export interface FxRates {
  reporting_currency: string;
  /** The newest fetched day ("2026-11-25"), or null before the first fetch (only fixed rates then). */
  day: string | null;
  /** Currencies fixed to the US dollar, which convert from the start. */
  fixed: string[];
  rates: Record<string, number>;
}

export interface Amount {
  currency: string;
  minor: number;
}

/** One amount in another currency, in whole minor units of it; null when either currency has no rate. */
export function convertMinor(minor: number, from: string, to: string, rates: Record<string, number>): number | null {
  if (from === to) return minor;
  const perFrom = rates[from];
  const perTo = rates[to];
  if (!perFrom || !perTo || !isCurrency(from) || !isCurrency(to)) return null;
  const scale = 10 ** (CURRENCIES[to].decimals - CURRENCIES[from].decimals);
  return Math.round(((minor * perTo) / perFrom) * scale);
}

export interface Total {
  currency: CurrencyCode;
  minor: number;
  /** Some of it was converted. */
  approx: boolean;
  /** Currencies left out for want of a rate. */
  missing: string[];
}

/** Amounts in several currencies as one total in `to`. */
export function totalIn(amounts: readonly Amount[], to: CurrencyCode, rates: Record<string, number>): Total {
  let minor = 0;
  let approx = false;
  const missing: string[] = [];
  for (const a of amounts) {
    const got = convertMinor(a.minor, a.currency, to, rates);
    if (got === null) {
      if (!missing.includes(a.currency)) missing.push(a.currency);
      continue;
    }
    minor += got;
    if (a.currency !== to) approx = true;
  }
  return { currency: to, minor, approx, missing };
}

/** "≈ USD 1,234.50" when any of it was converted, "USD 1,234.50" when none was. */
export function showTotal(total: Pick<Total, 'currency' | 'minor' | 'approx'>): string {
  return `${total.approx ? '≈ ' : ''}${formatMoney(total.minor, total.currency)}`;
}

/** The reporting currency as the money helpers take it (USD if the setting is one this app does not know). */
export function reportingCurrency(fx: Pick<FxRates, 'reporting_currency'>): CurrencyCode {
  return isCurrency(fx.reporting_currency) ? fx.reporting_currency : 'USD';
}

/** Currencies offered in Settings → Reporting currency, the first being the default. */
export const REPORTING_CURRENCIES = ['USD', 'AED', 'EUR', 'GBP', 'SAR', 'QAR', 'INR', 'CAD'] as const;

/** Where the rates come from (its terms ask for a credit line). */
export const RATES_SITE = 'https://www.exchangerate-api.com';
