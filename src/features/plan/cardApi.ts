/**
 * Paying for the plan by card through Creem (owner, 2026-10-20). The server (create-checkout) works out the amount,
 * asks Creem for a checkout page and gives back its address; the app opens it. When Creem says it is paid, the plan
 * is extended (creem-webhook). Card payments are off, test (platform admins only) or live — the platform owner's
 * switch in the console.
 */
import { useMutation, useQuery } from '@tanstack/react-query';

import { functionError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export type CardMode = 'off' | 'test' | 'live';

/** The card price in US dollars (what Creem charges, tax added where it applies), and whether it is on. */
export interface CardPrice {
  card_payments: CardMode;
  /** Paying by bank transfer or a card link, with a request the platform owner switches on (brief 5.3); off until set. */
  bank_transfer: boolean;
  intl_price_per_branch_minor: number;
  intl_extra_person_minor: number;
  intl_currency: string;
  included_people: number;
}

export function useCardPrice() {
  return useQuery({
    queryKey: ['platform', 'card-price'],
    queryFn: async (): Promise<CardPrice> => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('card_payments, bank_transfer, intl_price_per_branch_minor, intl_extra_person_minor, intl_currency, included_people')
        .single();
      if (error) throw error;
      return data as unknown as CardPrice;
    },
  });
}

/**
 * The ways the plan page offers to pay (website brief 5.3): by card while card payments are live (in test, platform
 * owners only); by bank transfer or a card link once that is switched on; and, with neither, a way to contact us.
 */
export function payOptions(price: CardPrice | undefined, admin: boolean): { card: boolean; bank: boolean; contact: boolean } {
  if (!price) return { card: false, bank: false, contact: false };
  const card = price.card_payments === 'live' || (price.card_payments === 'test' && admin);
  const bank = price.bank_transfer;
  return { card, bank, contact: !card && !bank };
}

/** Asks for a checkout and goes to it (the same tab: Creem brings the owner back to this screen). */
export function usePayByCard(businessId: string) {
  return useMutation({
    mutationFn: async (months: number) => {
      const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/plan` : undefined;
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { business_id: businessId, months, return_url: returnUrl },
      });
      if (error) throw await functionError(error);
      const url = (data as { checkout_url?: string }).checkout_url;
      if (!url) throw new Error('no checkout');
      window.location.assign(url);
    },
  });
}

/** A card payment after coming back from Creem: pending until Creem's message arrives (usually seconds). */
export function useCardPayment(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ['card-payment', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('card_payments').select('status, paid_until, months').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as { status: 'pending' | 'paid' | 'refunded' | 'review'; paid_until: string | null; months: number } | null;
    },
    refetchInterval: (q) => (q.state.data?.status === 'pending' && q.state.dataUpdateCount < 100 ? 3000 : false),
  });
}
