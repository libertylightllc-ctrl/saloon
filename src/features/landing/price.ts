/**
 * The visitor's plan price, as the pricing card shows it (UAE price in the UAE, the international one elsewhere),
 * read from the settings salons are billed from. Also used by the FAQ and the "less than … a day" line (brief 2.11).
 */
import { usePublicPrices } from '@/features/plan/api';
import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';

import { useVisitorInUae } from './visitor';

const money = (minor: number, currency: string) => (isCurrency(currency) ? formatMoney(minor, currency) : `${currency} ${minor / 100}`);

export interface LandingPrice {
  price: string;
  extra: string;
  /** The monthly price ÷ 30, rounded up to the cent: "less than" this a day. */
  perDay: string;
  people: number;
  trialDays: number;
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
    price: money(minor, currency),
    extra: money(uae ? p.extra_person_minor : p.intl_extra_person_minor, currency),
    perDay: money(Math.ceil(minor / 30), currency),
    people: p.included_people,
    trialDays: p.trial_days,
  };
}
