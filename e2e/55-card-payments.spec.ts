/**
 * Paying for the plan by card through Creem (owner, 2026-10-20: the Creem handoff). In test mode only platform
 * admins see Pay by card. The owner picks 6 months (10% off); the server asks Creem (the local creem-sink stand-in) for a
 * checkout with the plan product and the whole amount — the extra people included — and the owner goes to it. Creem's
 * signed "paid" message switches the plan on; a badly signed one is refused; the same message again changes nothing.
 * Back on Plan & billing the owner sees it paid.
 */
import { createHmac } from 'crypto';

import { admin, createOwner, createStaff, makePlatformAdmin } from './support/api';
import { SUPABASE_URL } from './support/env';
import { expect, test } from './support/fixtures';
import { id, ownerOn } from './support/ui';

/** The local signing secret the webhook accepts on the local stack only (supabase/config.toml). */
const LOCAL_SECRET = 'local-creem-webhook';
const PLAN_6M = 'prod_61pijGyfC6aRedhxIyypxe';
const sign = (body: string, secret = LOCAL_SECRET) => createHmac('sha256', secret).update(body).digest('hex');
const send = (body: string, signature: string) =>
  fetch(`${SUPABASE_URL}/functions/v1/creem-webhook`, { method: 'POST', headers: { 'creem-signature': signature, 'content-type': 'application/json' }, body });

test('an owner pays 6 months by card: one payment with the extra person, the plan switches on once', async ({ page, mode }) => {
  // Test mode: only platform admins see the button (left on: other owners are not admins).
  await admin.from('platform_settings').update({ card_payments: 'test' }).eq('id', true);
  const owner = await createOwner(mode);
  await makePlatformAdmin(owner.email);
  // 5 people: the owner and 4 logins, one over the 4 included.
  for (let i = 0; i < 4; i += 1) await createStaff(owner, 'staff');
  const { data: before } = await admin.from('subscriptions').select('paid_until').eq('business_id', owner.businessId).single();

  await ownerOn(page, mode, owner.email, owner.password);
  await page.goto('/plan');
  await expect(id(page, 'plan-card')).toBeVisible();
  await expect(id(page, 'plan-card-test')).toBeVisible();
  await id(page, 'plan-months-6').click();
  // (13.99 + 2.99) × 5.4 (6 months at 10% off), tax added by Creem where it applies.
  await expect(id(page, 'plan-card-total')).toHaveText('USD 91.69 + tax where it applies');

  // Creem's checkout page (the stand-in's address carries what was asked).
  await page.route('https://checkout.creem.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>Creem test checkout</p>' }));
  await id(page, 'plan-card-pay').click();
  await page.waitForURL('https://checkout.creem.test/**');
  const asked = new URL(page.url()).searchParams;
  expect(asked.get('product')).toBe(PLAN_6M);
  expect(asked.get('price')).toBe('9169');
  expect(asked.get('email')).toBe(owner.email);
  const requestId = asked.get('request')!;
  expect(asked.get('success')).toMatch(new RegExp(`/plan\\?paid=${requestId}$`));
  const { data: pending } = await admin.from('card_payments').select('status, checkout_id, amount_minor, extra_people').eq('id', requestId).single();
  expect(pending).toMatchObject({ status: 'pending', amount_minor: 5094, extra_people: 1 });

  // Creem tells us it is paid (with 5% UAE VAT on top).
  const event = JSON.stringify({
    id: `evt_${requestId.slice(0, 8)}`,
    eventType: 'checkout.completed',
    created_at: Date.now(),
    object: {
      id: pending!.checkout_id,
      object: 'checkout',
      request_id: requestId,
      order: { id: `ord_${requestId.slice(0, 8)}`, amount: 5349, amount_paid: 5349, currency: 'USD', product: PLAN_6M, status: 'paid' },
      product: { id: PLAN_6M },
      customer: { email: owner.email },
      custom_fields: [],
      status: 'completed',
      metadata: { request_id: requestId },
      mode: 'test',
    },
  });
  expect((await send(event, sign(event, 'not-the-secret'))).status).toBe(401);
  expect((await admin.from('card_payments').select('status').eq('id', requestId).single()).data!.status).toBe('pending');
  const paid = await send(event, sign(event));
  expect(paid.status).toBe(200);
  expect(await paid.json()).toMatchObject({ result: 'paid' });
  // Creem retries: the same message again changes nothing.
  expect(await (await send(event, sign(event))).json()).toMatchObject({ result: 'duplicate' });

  const { data: after } = await admin.from('subscriptions').select('paid_until, access_type').eq('business_id', owner.businessId).single();
  const expected = new Date(`${before!.paid_until}T00:00:00Z`);
  expected.setUTCMonth(expected.getUTCMonth() + 6);
  expect(after).toMatchObject({ paid_until: expected.toISOString().slice(0, 10), access_type: 'paid' });

  // Back from Creem: paid, the plan on.
  await page.goto(`/plan?paid=${requestId}`);
  await expect(id(page, 'plan-card-return-text')).toContainText('Paid. Your plan is on until');
  await expect(id(page, 'plan-status-line')).toContainText('Paid until');
});
