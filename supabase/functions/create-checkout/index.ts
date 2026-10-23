// Pay for the plan by card (owner, 2026-10-20): the app asks for a Creem checkout for N months; the database works
// out the amount (the salon's people now) and records the payment as pending; Creem gives a checkout page to open.
// When Creem says it is paid, creem-webhook extends the plan. The Creem key never leaves the server.
// CREEM_API_BASE (local only) points at the creem-sink stand-in on the local stack.
import { createClient } from 'npm:@supabase/supabase-js@2.109.0';

import { API_BASE, checkoutBody, PRODUCTS, type CheckoutStart, type PlanKey } from '../_shared/creem.ts';
import { localOnly, secret } from '../_shared/env.ts';
import { cors, fail, json } from '../_shared/staff.ts';

const SITE = 'https://www.saloqo.com';

/** Where Creem sends the owner back: the plan screen on saloqo.com (or the local app on the local stack). */
function returnUrl(asked: unknown, requestId: string): string {
  const fallback = `${SITE}/plan`;
  const url = typeof asked === 'string' ? asked : fallback;
  const allowed = url.startsWith(`${SITE}/`) || url.startsWith('https://saloqo.com/') ||
    (Boolean(localOnly('CREEM_API_BASE')) && /^http:\/\/localhost:\d+\//.test(url));
  const base = allowed ? url.split('?')[0] : fallback;
  return `${base}?paid=${requestId}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth) return fail('not_signed_in', 401);
  const body = (await req.json().catch(() => ({}))) as { business_id?: string; months?: number; return_url?: string };

  // As the owner: the database checks the role and works out the amount.
  const asOwner = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await asOwner.rpc('card_checkout_start', { p_business: body.business_id, p_months: body.months });
  if (error) {
    const code = /card_unavailable|not_allowed|invalid_amount/.exec(error.message)?.[0] ?? 'unknown';
    return fail(code, code === 'not_allowed' ? 403 : 400);
  }
  const start = data as CheckoutStart;
  const product = PRODUCTS[start.mode][`${start.months}m` as PlanKey];
  const key = secret(start.mode === 'live' ? 'CREEM_API_KEY' : 'CREEM_TEST_API_KEY');
  if (!product || !key) return fail('card_unavailable', 503);

  const base = localOnly('CREEM_API_BASE') ?? API_BASE[start.mode];
  const res = await fetch(`${base}/v1/checkouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify(checkoutBody(start, product, returnUrl(body.return_url, start.request_id))),
  }).catch(() => null);
  const checkout = res && res.ok ? ((await res.json()) as { id?: string; checkout_url?: string }) : null;
  if (!checkout?.checkout_url) {
    console.error('creem checkout failed', res?.status, res && (await res.text().catch(() => '')));
    return fail('server_busy', 502);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.rpc('card_checkout_opened', { p_id: start.request_id, p_checkout_id: checkout.id ?? null });
  return json({ checkout_url: checkout.checkout_url, request_id: start.request_id });
});
