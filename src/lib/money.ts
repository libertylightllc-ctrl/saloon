/**
 * Money maths and formatting. All amounts are integers in minor units (fils: AED 1 = 100; 1000 for KWD; 1 for JPY).
 * Amounts show in the signed-in salon's currency (setActiveCurrency, set by the session) unless one is given.
 * Percentages are basis points (12% = 1200). Never use floats for money.
 *
 * Rounding is half away from zero, the same as Postgres round(numeric), so the app and the
 * database functions agree to the fil. Intermediate maths uses BigInt so large amounts
 * multiplied by rates cannot lose precision.
 */

import { CURRENCIES, isCurrency, type CurrencyCode } from './currencies';

export type { CurrencyCode } from './currencies';
export type Minor = number;
export type Bps = number;

export const DEFAULT_CURRENCY: CurrencyCode = 'AED';

let active: CurrencyCode = DEFAULT_CURRENCY;
/** The signed-in salon's currency; everything formats and parses in it by default. */
export function setActiveCurrency(code: string | null | undefined): void {
  active = code && isCurrency(code) ? code : DEFAULT_CURRENCY;
}
export function activeCurrency(): CurrencyCode {
  return active;
}
export const BPS_PER_WHOLE = 10_000;

/** Quantities are numeric(12,3) in the database. */
const QTY_DECIMALS = 3;
const PERCENT_DECIMALS = 2;

export function assertMinor(value: number, label = 'amount'): asserts value is Minor {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be an integer in minor units, got ${value}`);
  }
}

export function decimalsOf(currency: CurrencyCode): number {
  return CURRENCIES[currency].decimals;
}

function toSafeNumber(value: bigint, label: string): Minor {
  const result = Number(value);
  assertMinor(result, label);
  return result;
}

/** numerator / denominator, rounded half away from zero. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('denominator must be positive');
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const absRemainder = remainder < 0n ? -remainder : remainder;
  if (absRemainder * 2n >= denominator) {
    return quotient + (numerator < 0n ? -1n : 1n);
  }
  return quotient;
}

export function sum(amounts: readonly Minor[]): Minor {
  let total = 0n;
  for (const amount of amounts) {
    assertMinor(amount);
    total += BigInt(amount);
  }
  return toSafeNumber(total, 'sum');
}

export function add(...amounts: Minor[]): Minor {
  return sum(amounts);
}

export function subtract(a: Minor, b: Minor): Minor {
  assertMinor(a);
  assertMinor(b);
  return toSafeNumber(BigInt(a) - BigInt(b), 'difference');
}

/** Unit price × quantity. Quantity may have up to 3 decimals (e.g. 0.5 of a pack). */
export function multiply(unitMinor: Minor, qty: number | string): Minor {
  assertMinor(unitMinor, 'unit price');
  const qtyScaled = parseScaled(String(qty), QTY_DECIMALS);
  if (qtyScaled === null) throw new RangeError(`Invalid quantity: ${qty}`);
  const scale = 10n ** BigInt(QTY_DECIMALS);
  return toSafeNumber(divRound(BigInt(unitMinor) * qtyScaled, scale), 'total');
}

/** bps of an amount, e.g. 12% commission: percentOf(5000, 1200) → 600. */
export function percentOf(amount: Minor, bps: Bps): Minor {
  assertMinor(amount);
  assertMinor(bps, 'bps');
  return toSafeNumber(divRound(BigInt(amount) * BigInt(bps), BigInt(BPS_PER_WHOLE)), 'percent');
}

/**
 * A tax rate in basis points with up to one decimal, for rates like New York's 8.875% (887.5). Kept exact by working
 * in tenths of a basis point.
 */
export type TaxRate = number;

function tenthsOfBps(rate: TaxRate): bigint {
  const tenths = Math.round(rate * 10);
  if (!Number.isSafeInteger(tenths) || tenths < 0 || Math.abs(rate * 10 - tenths) > 1e-6) {
    throw new RangeError(`rate must be basis points with at most one decimal, got ${rate}`);
  }
  return BigInt(tenths);
}

/** Tax contained in a tax-inclusive amount: 5% of AED 105.00 inclusive → AED 5.00. Same rounding as create_sale. */
export function vatFromInclusive(gross: Minor, rate: TaxRate): Minor {
  assertMinor(gross);
  const r = tenthsOfBps(rate);
  return toSafeNumber(divRound(BigInt(gross) * r, BigInt(BPS_PER_WHOLE * 10) + r), 'vat');
}

/** Tax added on top of a net amount: 8.875% of USD 100.00 → USD 8.88. */
export function vatOnTop(net: Minor, rate: TaxRate): Minor {
  assertMinor(net);
  return toSafeNumber(divRound(BigInt(net) * tenthsOfBps(rate), BigInt(BPS_PER_WHOLE * 10)), 'vat');
}

/**
 * Split `total` in proportion to `weights` so the parts add up exactly to `total`
 * (largest-remainder method; ties go to the earlier item). Used for spreading a discount
 * across sale lines and for pro-rata refunds. If every weight is 0 the split is even.
 */
export function allocate(total: Minor, weights: readonly number[]): Minor[] {
  assertMinor(total);
  if (weights.length === 0) throw new RangeError('allocate needs at least one weight');
  weights.forEach((w) => {
    if (!Number.isSafeInteger(w) || w < 0) throw new RangeError('weights must be integers ≥ 0');
  });

  const effective = weights.every((w) => w === 0) ? weights.map(() => 1) : weights;
  const sign = total < 0 ? -1n : 1n;
  const absTotal = BigInt(Math.abs(total));
  const weightSum = effective.reduce((acc, w) => acc + BigInt(w), 0n);

  const parts = effective.map((w, index) => {
    const exact = absTotal * BigInt(w);
    return { index, base: exact / weightSum, remainder: exact % weightSum };
  });

  let leftover = absTotal - parts.reduce((acc, p) => acc + p.base, 0n);
  const byRemainder = [...parts].sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
  );
  for (const part of byRemainder) {
    if (leftover === 0n) break;
    part.base += 1n;
    leftover -= 1n;
  }
  return parts.map((p) => toSafeNumber(p.base * sign, 'allocation'));
}

// ── Parsing ──────────────────────────────────────────────────────────────────

const DIGIT_BLOCKS = [0x0660, 0x06f0, 0x0966]; // Arabic-Indic, Extended (Urdu), Devanagari

/** Converts Arabic-Indic, Urdu and Devanagari digits and separators to Latin. */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    const block = DIGIT_BLOCKS.find((start) => code >= start && code <= start + 9);
    if (block !== undefined) out += String(code - block);
    else if (ch === '٫')
      out += '.'; // Arabic decimal separator
    else if (ch === '٬')
      out += ','; // Arabic thousands separator
    else out += ch;
  }
  return out;
}

/** "12.5" with 3 decimals → 12500n. Returns null for anything that is not a plain decimal. */
function parseScaled(input: string, decimals: number): bigint | null {
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(input.trim());
  if (!match) return null;
  const [, minus, whole = '0', fraction = ''] = match;
  if (fraction.length > decimals) return null;
  const scaled = BigInt(whole + fraction.padEnd(decimals, '0'));
  return minus ? -scaled : scaled;
}

/**
 * Parses what a person typed ("1,240.5", "AED 25", "٢٥") into minor units.
 * Returns null when it is not a valid amount for the currency (e.g. 3 decimals for AED).
 */
export function parseMoney(input: string, currency: CurrencyCode = activeCurrency()): Minor | null {
  const cleaned = normalizeDigits(input)
    .replace(new RegExp(`^\\s*(-)?\\s*${currency}\\s*`, 'i'), '$1')
    .replace(/[,\s]/g, '');
  const scaled = parseScaled(cleaned, decimalsOf(currency));
  if (scaled === null) return null;
  const result = Number(scaled);
  return Number.isSafeInteger(result) ? result : null;
}

/** "12" → 1200, "12.5" → 1250. Up to 2 decimals, 0–100%. */
export function parsePercent(input: string): Bps | null {
  const scaled = parseScaled(normalizeDigits(input).replace(/%\s*$/, ''), PERCENT_DECIMALS);
  if (scaled === null || scaled < 0n || scaled > BigInt(BPS_PER_WHOLE)) return null;
  return Number(scaled);
}

/** A tax rate: "8.875" → 887.5, "5" → 500. Up to 3 decimals, 0–30%. */
export function parseTaxRate(input: string): TaxRate | null {
  const scaled = parseScaled(normalizeDigits(input).replace(/%\s*$/, ''), PERCENT_DECIMALS + 1);
  if (scaled === null || scaled < 0n || scaled > 30_000n) return null;
  return Number(scaled) / 10;
}

// ── Formatting (always Latin digits, see 01-PRODUCT §3.18) ───────────────────

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface FormatOptions {
  /** Thousands separators, default true. Turn off for editable input values. */
  grouping?: boolean;
}

/** 124000 → "1,240.00" (no currency code). */
export function formatAmount(
  amount: Minor,
  currency: CurrencyCode = activeCurrency(),
  { grouping = true }: FormatOptions = {},
): string {
  assertMinor(amount);
  const decimals = decimalsOf(currency);
  const digits = String(Math.abs(amount)).padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals);
  const grouped = grouping ? groupThousands(whole) : whole;
  const body = decimals > 0 ? `${grouped}.${fraction}` : grouped;
  return amount < 0 ? `-${body}` : body;
}

/** 124000 → "AED 1,240.00"; -500 → "-AED 5.00". */
/** No-break space: "AED" and the number never end up on two lines. */
const NBSP = '\u00a0';

export function formatMoney(amount: Minor, currency: CurrencyCode = activeCurrency()): string {
  const body = formatAmount(Math.abs(amount), currency);
  return amount < 0 ? `-${currency}${NBSP}${body}` : `${currency}${NBSP}${body}`;
}

/** 1200 → "12%", 1250 → "12.5%", 25 → "0.25%"; a tax rate 887.5 → "8.875%". */
export function formatBps(bps: Bps | TaxRate): string {
  const tenths = Math.abs(Number(tenthsOfBps(Math.abs(bps))));
  const whole = Math.trunc(tenths / 1000);
  const fraction = String(tenths % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  const body = fraction ? `${whole}.${fraction}` : String(whole);
  return `${bps < 0 ? '-' : ''}${body}%`;
}
