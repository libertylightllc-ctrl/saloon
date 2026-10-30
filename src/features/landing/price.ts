/**
 * The visitor's plan price, as the pricing card shows it (UAE price in the UAE, the international one elsewhere),
 * read from the settings salons are billed from. Also used by the FAQ and the "under … a day" line.
 */
import { PER_DAY_UNDER, priceText } from '@/config/pricing';
import { usePublicPrices } from '@/features/plan/api';

import { useVisitorInUae } from './visitor';


export interface LandingPrice {
  price: string;
  extra: string;
  /** "Under" this a day (src/config/pricing.json: AED 2, USD 0.50). */
  perDay: string;
  people: number;
  /** A new salon's free days (Console → Settings, "Free days for a new salon"). */
  freeDays: number;
}

/** Null until both the price and the visitor's country are known. */
export function useLandingPrice(): LandingPrice | null {
  const prices = usePublicPrices();
  const uae = useVisitorInUae();
  const p = prices.data;
  if (!p || uae === null) return null;
  const minor = uae ? p.price_per_branch_minor : p.intl_price_per_branch_minor;
  const currency = uae ? p.currency : p.intl_currency;
  return {
    price: priceText(minor, currency),
    extra: priceText(uae ? p.extra_person_minor : p.intl_extra_person_minor, currency),
    perDay: priceText(PER_DAY_UNDER[currency] ?? Math.ceil(minor / 30), currency),
    people: p.included_people,
    freeDays: p.public_free_days,
  };
}
