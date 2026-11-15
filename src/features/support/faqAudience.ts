/**
 * Who is reading the common questions, and whether prices and plans may show to them (owner's app check E6): the
 * signed-in login's type, or a visitor on Contact us. The price answer uses the live price, never a fixed one.
 */
import { useWorkspace } from '@/features/auth/session';
import { useLandingPrice } from '@/features/landing/price';
import { showsBilling, usePlanStatus } from '@/features/plan/api';
import { canOfferPlans } from '@/features/plan/storePolicy';
import { priceText } from '@/config/pricing';

import type { Asker } from './questions';

export interface FaqAudience {
  asker: Asker;
  /** Prices and paying may show. */
  plans: boolean;
  /** Billing is on, so an ended free time can stop new work. */
  billing: boolean;
  /** The price answer's figures; null hides the price question. */
  price: { price: string; extra: string; people: number } | null;
}

/** Signed in: their login type; the owner sees prices only where the plan screen shows them. */
export function useMemberFaq(): FaqAudience {
  const { business, role } = useWorkspace();
  const plan = usePlanStatus(business.id).data;
  const plans = Boolean(plan && canOfferPlans && role === 'owner' && showsBilling(plan));
  return {
    asker: role,
    plans,
    billing: Boolean(plan?.billing_enabled),
    price:
      plan && plans
        ? {
            price: priceText(plan.base_minor, plan.currency),
            extra: priceText(plan.extra_person_minor, plan.currency),
            people: plan.included_people,
          }
        : null,
  };
}

/** Contact us (not signed in): the website's price for their country; none in the phone apps. */
export function useGuestFaq(): FaqAudience {
  const p = useLandingPrice();
  const plans = Boolean(p && canOfferPlans);
  return {
    asker: 'guest',
    plans,
    billing: false,
    price: p && plans ? { price: p.price, extra: p.extra, people: p.people } : null,
  };
}
