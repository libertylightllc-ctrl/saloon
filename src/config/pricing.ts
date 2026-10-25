/**
 * How Saloqo is priced (full update brief, Phase 2, 2026-10-25): the website, the app, the FAQ, the terms and the
 * structured data all work from this. The monthly prices themselves are in the database (`platform_settings`, set in
 * the console, the one billing reads): per branch, for up to `included_people` people who sign in there, then a price
 * per extra person. The billing lengths and their discounts are in pricing.json (the website's build reads it too):
 * 1 month; 6 months at 10% off (you pay 5.4 months); 12 months for the price of 10. No auto-renewal.
 */
import values from './pricing.json';

export interface BillingLength {
  months: number;
  /** Months paid, in tenths: 6 months at 10% off = 54 (5.4 months). */
  payTenths: number;
  saveBps?: number;
  freeMonths?: number;
  bestValue?: boolean;
}

export const BILLING_LENGTHS: readonly BillingLength[] = values.lengths;
export const PER_DAY_UNDER: Readonly<Record<string, number>> = values.perDayUnder;

/** A monthly amount for a whole billing length, in minor units (rounded half up to the cent or fils). */
export function lengthTotal(monthlyMinor: number, length: BillingLength): number {
  return Math.round((monthlyMinor * length.payTenths) / 10);
}

export interface PriceTerms {
  /** Per branch, per month, for up to `includedPeople`. */
  baseMinor: number;
  extraMinor: number;
  includedPeople: number;
}

/** One branch's monthly price for this many people who sign in there. */
export function branchMonthly(people: number, terms: PriceTerms): number {
  return terms.baseMinor + Math.max(0, people - terms.includedPeople) * terms.extraMinor;
}

/** A salon's monthly price: the sum over its branches (each with its own people). */
export function salonMonthly(peoplePerBranch: readonly number[], terms: PriceTerms): number {
  return peoplePerBranch.reduce((total, people) => total + branchMonthly(people, terms), 0);
}

/**
 * Who counts at which branch: everyone who signs in counts at their own branch; the owner and an accountant (who see
 * every branch) count once, at the first branch. `branchOf` is null for those who belong to the whole salon.
 */
export function peoplePerBranch(branchIds: readonly string[], people: readonly { branchOf: string | null }[]): number[] {
  return branchIds.map((id, i) => people.filter((p) => (p.branchOf === null ? i === 0 : p.branchOf === id)).length);
}

/** "AED 50", "AED 10", "USD 13.99": whole amounts without ".00" (prices only; the app's money keeps two decimals). */
export function priceText(minor: number, currency: string): string {
  const digits = minor % 100 === 0 ? 0 : 2;
  return `${currency}\u00a0${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
