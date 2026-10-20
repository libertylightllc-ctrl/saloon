// Creem (card payments for the plan, 2026-10-20): the products per mode, the checkout request, and the webhook
// signature. No keys here: they are the server's secrets (CREEM_API_KEY / CREEM_WEBHOOK_SECRET for live,
// CREEM_TEST_API_KEY / CREEM_TEST_WEBHOOK_SECRET for test), set by the owner in Supabase → Edge Functions → Secrets.

export type CreemMode = 'test' | 'live';
export type PlanKey = '1m' | '3m' | '6m' | '12m';

export const API_BASE: Record<CreemMode, string> = { test: 'https://test-api.creem.io', live: 'https://api.creem.io' };

/**
 * One-time USD products, one per plan length (the extra people go in the price, option A; the "Extra person" product
 * prod_61q2RJYaCUHsqj1yr4SIuJ is not used). IDs from the owner, 2026-10-20.
 */
export const PRODUCTS: Record<CreemMode, Partial<Record<PlanKey, string>>> = {
  test: {
    '1m': 'prod_4JcXP12MFAZTR0Y6eTl1Me',
    '3m': 'prod_MEVtqskxRAyCdU3o6VzMU',
    '6m': 'prod_61pijGyfC6aRedhxIyypxe',
    '12m': 'prod_4ubr3Q9he43BT7XYTo6jjd',
  },
  live: {
    '1m': 'prod_24kMgXPzmC9pxCsagloh9G',
    '3m': 'prod_2UO1heob9dYnrbv4InaIIr',
    '6m': 'prod_2lkxrRhz5TLl5PHc1wGJRq',
    '12m': 'prod_60bWcpZ3x06SvOLa03t9d5',
  },
};

/** The plan length a product is for (a payment made from a plain payment link names only its product). */
export function monthsOfProduct(productId: string | undefined): number | null {
  for (const mode of ['test', 'live'] as const) {
    for (const [key, id] of Object.entries(PRODUCTS[mode])) {
      if (id && id === productId) return Number(key.replace('m', ''));
    }
  }
  return null;
}

export interface CheckoutStart {
  request_id: string;
  mode: CreemMode;
  months: number;
  extra_people: number;
  amount_minor: number;
  base_minor: number;
  email: string | null;
  salon_code: string;
}

/**
 * What Creem is asked for: the plan product for the months; with extra people, the whole amount as the price (one
 * payment); the owner's email; our request id in the metadata so the webhook finds the payment.
 */
export function checkoutBody(start: CheckoutStart, productId: string, successUrl: string) {
  return {
    product_id: productId,
    request_id: start.request_id,
    units: 1,
    ...(start.amount_minor !== start.base_minor ? { custom_price: start.amount_minor } : {}),
    ...(start.email ? { customer: { email: start.email } } : {}),
    success_url: successUrl,
    metadata: {
      request_id: start.request_id,
      salon_code: start.salon_code,
      months: String(start.months),
      extra_people: String(start.extra_people),
    },
  };
}

/** HMAC-SHA256 of the raw body with the webhook secret, as hex. */
export async function signature(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Equal in constant time (as far as the lengths allow). */
export function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The "Salon code" a customer typed at checkout (plain payment links), if any. */
export function salonCodeField(fields: unknown): string | null {
  if (!Array.isArray(fields)) return null;
  for (const f of fields as { key?: string; label?: string; text?: { value?: string } }[]) {
    const name = `${f.key ?? ''} ${f.label ?? ''}`.toLowerCase();
    if (name.includes('salon') && f.text?.value) return f.text.value.trim();
  }
  return null;
}
