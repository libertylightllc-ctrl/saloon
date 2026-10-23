// Creem tells us about payments (2026-10-20): checkout.completed extends the plan, refund.created marks the payment
// refunded for the platform owner to look at. Every request must carry a valid creem-signature (HMAC-SHA256 of the
// raw body with the webhook secret; test and live each have their own); anything else gets 401 and changes nothing.
// Creem retries for up to a day: the database makes the same event harmless the second time.
import { createClient } from 'npm:@supabase/supabase-js@2.109.0';

import { monthsOfProduct, salonCodeField, sameHex, signature } from '../_shared/creem.ts';
import { localOnly, secret } from '../_shared/env.ts';
import { json } from '../_shared/staff.ts';

interface Event {
  id?: string;
  eventType?: string;
  object?: Record<string, unknown> & {
    id?: string;
    request_id?: string;
    metadata?: Record<string, string>;
    mode?: string;
    order?: { id?: string; amount?: number; amount_paid?: number; amount_due?: number; currency?: string; product?: string };
    product?: { id?: string };
    customer?: { email?: string };
    custom_fields?: unknown;
    checkout?: { id?: string; request_id?: string; metadata?: Record<string, string> };
    refund_amount?: number;
    refund_currency?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const raw = await req.text();
  const given = (req.headers.get('creem-signature') ?? '').trim().toLowerCase();
  const secrets = [secret('CREEM_WEBHOOK_SECRET'), secret('CREEM_TEST_WEBHOOK_SECRET'), localOnly('CREEM_WEBHOOK_SECRET_LOCAL')]
    .filter((s): s is string => Boolean(s));
  let valid = false;
  for (const s of secrets) if (given && sameHex(given, await signature(raw, s))) valid = true;
  if (!valid) return json({ error: 'bad signature' }, 401);

  const event = JSON.parse(raw) as Event;
  const o = event.object ?? {};
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const mode = o.mode === 'prod' || o.mode === 'live' ? 'live' : 'test';

  if (event.eventType === 'checkout.completed') {
    const { data, error } = await admin.rpc('card_payment_completed', {
      p: {
        request_id: o.metadata?.request_id ?? o.request_id ?? null,
        checkout_id: o.id ?? null,
        order_id: o.order?.id ?? null,
        months: monthsOfProduct(o.product?.id ?? o.order?.product),
        salon_code: o.metadata?.salon_code ?? salonCodeField(o.custom_fields),
        mode,
        // What Creem really received (after any discount, with any tax); the order's amount is before the discount.
        paid_minor: o.order?.amount_paid ?? o.order?.amount_due ?? o.order?.amount ?? null,
        paid_currency: o.order?.currency ?? null,
        email: o.customer?.email ?? null,
      },
    });
    // A database failure is answered 500, so Creem tries again later.
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }
  if (event.eventType === 'refund.created') {
    const { data, error } = await admin.rpc('card_payment_refunded', {
      p: {
        request_id: o.checkout?.metadata?.request_id ?? o.checkout?.request_id ?? null,
        checkout_id: o.checkout?.id ?? null,
        order_id: o.order?.id ?? null,
        refund_minor: o.refund_amount ?? null,
        refund_currency: o.refund_currency ?? null,
      },
    });
    if (error) return json({ error: error.message }, 500);
    return json(data);
  }
  return json({ ignored: event.eventType ?? null });
});
