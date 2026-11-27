/**
 * The console's Support, Part E of the owner's console brief (27 Nov 2026). E1: each conversation has a status, with
 * filters; Solved or Closed while nobody has answered needs a reason; every change is in Changes. E2: a conversation
 * handed to a person tells the platform owners (a notice that opens Support, and the badges). E3: saved replies filled
 * in with who wrote, Reply on WhatsApp only with their OK (kept first, then WhatsApp opens), internal notes nobody
 * else sees. E4: "Chat with us on WhatsApp" in Help & support names the salon and its code. Locally the ai-sink
 * stand-in plays the AI: a refund is handed to a person.
 */
import type { Page } from '@playwright/test';

import { admin, createOwner, makePlatformAdmin, type Owner } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, tab, text } from './support/ui';

const PHONE = '+971501234567';

/** The owner asks for a refund in Help & support; the AI hands it to a person (Waiting for you). */
async function asksForRefund(page: Page, owner: Owner) {
  await tab(page, 'more');
  await id(page, 'more-support').click();
  await id(page, 'support-input').fill('I paid and want a refund');
  await id(page, 'support-send').click();
  await expect(id(page, 'support-message-assistant').first()).toContainText('A person from the Saloqo team will follow up here.');
  const { data } = await admin.from('businesses').select('name').eq('id', owner.businessId).single().throwOnError();
  return data!.name as string;
}

async function openSupport(office: Page, code: string, filter = 'waiting_team') {
  await office.goto('/console?tab=support');
  await id(office, `console-support-filter-${filter}`).click();
  await id(office, `support-thread-${code}`).click();
}

test('statuses, the alert, saved replies, a note and a reply on WhatsApp (E1–E3)', async ({ page, mode, device }) => {
  // A platform owner with a salon login of their own, so the notice reaches them.
  const platform = await createOwner(mode);
  await makePlatformAdmin(platform.email);
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  const salon = await asksForRefund(page, owner);
  const { data: me } = await owner.client.auth.getUser();
  await admin
    .from('owner_contacts')
    .upsert({ user_id: me.user!.id, phone: PHONE, whatsapp_ok: true, whatsapp_ok_at: new Date().toISOString() })
    .throwOnError();

  // E2: the notice opens Support; More's Platform console row counts what waits (other tests may add to it).
  const office = await device();
  await ownerOn(office, mode, platform.email, platform.password);
  await office.goto('/more');
  await expect(id(office, 'more-admin-badge')).toHaveText(/^([1-9]|9\+)$/);
  await office.goto('/notifications');
  await id(office, 'notification-support_waiting').first().click();
  await expect(office).toHaveURL(/\/console\?tab=support/);
  await expect(id(office, 'console-tab-support')).toHaveText(/^Support \(\d+\)$/);

  // E1: Waiting for you, with no reply yet.
  await id(office, 'console-support-filter-waiting_team').click();
  const row = id(office, `support-thread-${owner.code}`);
  await expect(row).toContainText('Waiting for you');
  await expect(row).toContainText('No reply yet');
  await row.click();
  await expect(id(office, 'console-support-stage')).toContainText('Waiting for you');

  // E3: a saved reply, filled in with the name and salon.
  const title = `Thanks ${owner.code}`;
  await id(office, 'console-saved-manage').click();
  await id(office, 'console-saved-title').fill(title);
  await id(office, 'console-saved-body').fill('Hi {name}, thanks for writing from {salon}.');
  await id(office, 'console-saved-save').click();
  await expect(text(office, 'Saved reply saved')).toBeVisible();
  await id(office, 'console-saved-manage').click();
  await id(office, `console-saved-${title}`).click();
  const reply = `Hi ${owner.name}, thanks for writing from ${salon}.`;
  await expect(id(office, 'console-support-input')).toHaveValue(reply);

  // An internal note.
  await id(office, 'console-support-note-input').fill('Asked for the payment receipt');
  await id(office, 'console-support-note-add').click();
  await expect(id(office, 'console-support-notes')).toContainText('Asked for the payment receipt');

  // Reply on WhatsApp: kept in the conversation first, then WhatsApp opens with it (the test answers for WhatsApp).
  await office.context().route(/^https:\/\/wa\.me\//, (route) => route.fulfill({ contentType: 'text/plain', body: 'WhatsApp' }));
  const [popup] = await Promise.all([office.waitForEvent('popup'), id(office, 'console-support-whatsapp').click()]);
  await popup.waitForLoadState();
  const url = new URL(popup.url());
  expect(url.pathname).toBe('/971501234567');
  expect(url.searchParams.get('text')).toBe(reply);
  await popup.close();
  await expect(id(office, 'console-support-message-support').last()).toContainText('on WhatsApp');
  await expect(id(office, 'console-support-stage')).toContainText('Waiting for salon');
  await expect(id(office, 'console-support-reply-time')).toContainText('First reply:');

  // The salon sees the answer, marked WhatsApp, and never the note.
  await page.reload();
  await expect(id(page, 'support-message-support').last()).toContainText(reply);
  await expect(id(page, 'support-message-support').last()).toContainText('on WhatsApp');
  await expect(page.getByText('Asked for the payment receipt')).toHaveCount(0);

  // Answered, so Solved needs no reason.
  await id(office, 'console-support-to-solved').click();
  await expect(text(office, 'Moved to Solved')).toBeVisible();
  await id(office, 'console-support-filter-solved').click();
  await expect(id(office, `support-thread-${owner.code}`)).toContainText('Solved');

  // Changes, in sentences.
  await id(office, 'console-tab-audit').click();
  const who = `${owner.name}, ${salon}`;
  await expect(office.locator('[data-testid="audit-support:whatsapp"]').filter({ hasText: who }).first()).toContainText(
    `Answered ${who} on WhatsApp`,
  );
  await expect(office.locator('[data-testid="audit-support:stage"]').filter({ hasText: who }).first()).toContainText(
    `Support conversation with ${who}: Waiting for salon → Solved`,
  );
  await expect(office.locator('[data-testid="audit-support:saved_reply"]').filter({ hasText: title }).first()).toContainText(
    `Saved reply added: ${title}`,
  );
  // Tidy: the saved reply is removed (kept, hidden) so the list does not grow with each run.
  const { data: saved } = await admin.from('support_saved_replies').select('id').eq('title', title).single().throwOnError();
  await admin.from('support_saved_replies').update({ removed_at: new Date().toISOString() }).eq('id', saved!.id).throwOnError();
});

test('closing a conversation nobody answered needs a reason, and it can be taken back (E1)', async ({ page, mode, device }) => {
  const platform = await createOwner(mode);
  await makePlatformAdmin(platform.email);
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  const salon = await asksForRefund(page, owner);

  const office = await device();
  await ownerOn(office, mode, platform.email, platform.password);
  await openSupport(office, owner.code);
  // No WhatsApp OK: no WhatsApp button.
  await expect(id(office, 'console-support-whatsapp')).toHaveCount(0);
  await id(office, 'console-support-to-closed').click();
  await expect(id(office, 'console-support-reason-confirm')).toBeDisabled();
  await id(office, 'console-support-reason').fill('Answered by phone');
  await id(office, 'console-support-reason-confirm').click();
  await expect(text(office, 'Moved to Closed')).toBeVisible();

  await openSupport(office, owner.code, 'closed');
  await id(office, 'console-support-to-waiting_team').click();
  await expect(text(office, 'Moved to Waiting for you')).toBeVisible();
  await expect(id(office, 'console-support-stage')).toContainText('Waiting for you');

  // The conversation stays open after taking it back; Changes is opened by its address.
  await office.goto('/console?tab=audit');
  await expect(office.locator('[data-testid="audit-support:stage"]').filter({ hasText: 'Answered by phone' }).filter({ hasText: salon }).first()).toContainText(
    `Support conversation with ${owner.name}, ${salon}: Waiting for you → Closed (Answered by phone)`,
  );
});

test('Help & support: Chat with us on WhatsApp names the salon and its code (E4)', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  // The team's WhatsApp number, as the console's setting gives it (only this page sees it).
  let number = '+971500000001';
  await page.route('**/rest/v1/rpc/site_contact', (route) =>
    route.fulfill({ json: { whatsapp_number: number, whatsapp_message: 'Hi Saloqo' } }),
  );
  await page.context().route(/^https:\/\/wa\.me\//, (route) => route.fulfill({ contentType: 'text/plain', body: 'WhatsApp' }));
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-support').click();
  const { data } = await admin.from('businesses').select('name').eq('id', owner.businessId).single().throwOnError();
  const [popup] = await Promise.all([page.waitForEvent('popup'), id(page, 'support-whatsapp').click()]);
  await popup.waitForLoadState();
  const url = new URL(popup.url());
  expect(url.pathname).toBe('/971500000001');
  expect(url.searchParams.get('text')).toBe(`Hi Saloqo, I need help with the app. Salon: ${data!.name} (${owner.code})`);
  await popup.close();

  // With no number set, the button is not there.
  number = '';
  await page.reload();
  await expect(id(page, 'support-input')).toBeVisible();
  await expect(id(page, 'support-whatsapp')).toHaveCount(0);
});
