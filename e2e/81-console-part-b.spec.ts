/** Platform console, Part B (owner's brief, 24 Nov 2026): the Overview's business numbers.
 * B1–B5 monthly income, conversion and churn in the reporting currency; B2 salons by status; B3/B7 active and at-risk
 * salons; B6 coming up: a free period ending in 3 days, messaged in the owner's language (Arabic) on WhatsApp, logged
 * in Changes and the salon's history; a plan request waiting 10 days; B8 new salons by week; B9 support; B10 health.
 * H2 the reporting currency is set in Settings (in one look only: it is one setting for the whole service). */
import { admin, createOwner, dubaiDate, makePlatformAdmin } from './support/api';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap, text } from './support/ui';

const DAY = 86_400_000;

test('console Part B: business numbers, coming up with Message owner, sign-ups, support and system health', async ({ page, mode }) => {
  const n = uid().slice(-6);
  const dev = await createOwner(mode);
  await makePlatformAdmin(dev.email);

  // A salon paying AED 990 a year (AED 82.50 a month).
  const payer = await createOwner(mode, { businessName: `Payer B ${mode} ${n}`, plan: false });
  const { error: payError } = await dev.client.rpc('admin_activate', { p_business: payer.businessId, p_months: 12, p_amount_minor: 99_000, p_note: 'Bank transfer' });
  if (payError) throw payError;

  // B6: a free period ending in 3 days; the owner agreed to WhatsApp and uses the app in Arabic.
  const ending = await createOwner(mode, { businessName: `Ending ${mode} ${n}`, plan: 'trial' });
  const { error: endError } = await admin.from('subscriptions').update({ free_until: dubaiDate(3) }).eq('business_id', ending.businessId);
  if (endError) throw endError;
  const endingUser = (await ending.client.auth.getUser()).data.user?.id;
  if (!endingUser) throw new Error('no user');
  const { error: contactError } = await admin
    .from('owner_contacts')
    .insert({ user_id: endingUser, phone: '+971501234567', whatsapp_ok: true, whatsapp_ok_at: new Date().toISOString() });
  if (contactError) throw contactError;
  const { data: member, error: memberError } = await admin.from('members').select('id').eq('business_id', ending.businessId).eq('role', 'owner').single();
  if (memberError) throw memberError;
  const { error: seenError } = await admin
    .from('member_seen')
    .insert({ member_id: member.id, business_id: ending.businessId, last_seen_at: new Date().toISOString(), language: 'ar' });
  if (seenError) throw seenError;

  // B6: a plan request sent 10 days ago, not paid yet.
  const asking = await createOwner(mode, { businessName: `Asking ${mode} ${n}`, plan: 'trial' });
  const { error: askError } = await admin.from('plan_events').insert({
    business_id: asking.businessId,
    kind: 'request',
    months: 6,
    amount_minor: 30_000,
    currency: 'AED',
    created_at: new Date(Date.now() - 10 * DAY - 3_600_000).toISOString(),
  });
  if (askError) throw askError;

  await ownerOn(page, mode, dev.email, dev.password);
  await page.goto('/console');

  // B1–B5, B2, B3/B7: the cards are there, with numbers.
  await expect(id(page, 'console-mrr-value')).toContainText(/\d/);
  await expect(id(page, 'console-mrr-sub')).toContainText(/a year/);
  await expect(id(page, 'console-conversion-value')).toContainText(/%|—/);
  await expect(id(page, 'console-churn-value')).toContainText(/\d/);
  await expect(id(page, 'console-status-paid-value')).toContainText(/\d/);
  await expect(id(page, 'console-active-value')).toContainText(/\d/);
  await expect(id(page, 'console-at-risk-value')).toContainText(/\d/);
  await expect(id(page, 'console-fx-note')).toContainText(/ExchangeRate-API|fixed/);
  await snap(page, 'console-b-money', mode);

  // B6: the salon ending in 3 days, with the owner's language and WhatsApp.
  await id(page, 'console-coming-up').scrollIntoViewIfNeeded();
  if (await id(page, 'console-ending-all').isVisible()) await id(page, 'console-ending-all').click();
  const row = id(page, `console-ending-${ending.code}`);
  await expect(row).toContainText('In free period · ends');
  await expect(row).toContainText('in 3 days');
  await expect(row).toContainText('العربية');
  await expect(row).toContainText('WhatsApp +971501234567 (agreed)');

  // Message owner: Arabic text; logged first, then WhatsApp opens.
  await page.evaluate(() => {
    const w = window as unknown as { __opened: string[]; open: (url: string) => null };
    w.__opened = [];
    w.open = (url: string) => {
      w.__opened.push(url);
      return null;
    };
  });
  await id(page, `console-message-${ending.code}`).click();
  await expect(id(page, 'console-message-text')).toContainText('مرحبًا');
  await expect(id(page, 'console-message-text')).toContainText(`Ending ${mode} ${n}`);
  await snap(page, 'console-b-message', mode);
  await id(page, 'console-message-whatsapp').click();
  await expect(text(page, 'Saved in Changes and the salon’s history')).toBeVisible();
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  expect(opened).toHaveLength(1);
  expect(opened[0]).toMatch(/^https:\/\/wa\.me\/971501234567\?text=/);
  await expect(row).toContainText('Message opened');

  // B6: the plan request, waiting 10 days; it opens its salon.
  if (await id(page, 'console-requests-all').isVisible()) await id(page, 'console-requests-all').click();
  const request = id(page, `console-request-${asking.code}`);
  await expect(request).toContainText('waiting 10 days · 6 months');
  await snap(page, 'console-b-coming-up', mode);

  // B8, B9, B10.
  await expect(id(page, 'console-signups')).toContainText(/Last 12 weeks: \d+/);
  await expect(id(page, 'console-signups-legend')).toContainText('United Arab Emirates');
  await expect(id(page, 'console-support-sub')).toContainText(/Open conversations: \d+/);
  await expect(id(page, 'console-health-card_webhook')).toContainText(/Card payments: (Off|Test|Live)/);
  await expect(id(page, 'console-health-app')).toContainText(/Last 24 h: \d+/);
  await id(page, 'console-health').scrollIntoViewIfNeeded();
  await snap(page, 'console-b-service', mode);

  await request.click();
  await expect(id(page, 'console-salon-search')).toHaveValue(asking.code);
  await expect(id(page, 'console-access')).toBeVisible();

  // Changes: the message, in a sentence.
  await page.goto('/console');
  await id(page, 'console-tab-audit').click();
  await expect(page.locator('[data-testid="audit-salon:contact"]').filter({ hasText: `Ending ${mode} ${n}` })).toContainText(
    'WhatsApp message to the owner opened, the free period ends',
  );

  // The salon's own history says it too.
  await id(page, 'console-tab-salons').click();
  await id(page, 'console-salon-search').fill(ending.code);
  await id(page, `admin-salon-${ending.code}`).click();
  await id(page, 'console-salon-history').click();
  await expect(page.getByText(/The platform owner opened a message to the salon owner by WhatsApp: the free period ends on/).first()).toBeVisible();

  // H2: the reporting currency (one setting for everyone: changed and put back in one look only).
  if (mode === 'gents') {
    await page.goto('/console');
    await id(page, 'console-tab-settings').click();
    await id(page, 'console-reporting-AED').click();
    await expect(text(page, /Reporting currency: AED/)).toBeVisible();
    await page.goto('/console');
    await expect(id(page, 'console-mrr-value')).toContainText('AED');
    await id(page, 'console-tab-settings').click();
    await id(page, 'console-reporting-USD').click();
    await expect(text(page, /Reporting currency: USD/)).toBeVisible();
  }
});
