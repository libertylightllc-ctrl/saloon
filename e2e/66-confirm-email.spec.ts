/**
 * No email-confirmation wall (owner's fix list, final brief C2): a new owner is signed straight in and sent a link;
 * until they open it Home asks them to (× hides it until the next day; staff never see it) and a plan cannot be
 * bought. Opening the link, or resetting the password with the emailed code, confirms the address.
 */
import { admin, createOwner, createStaff, latestCode, openedConfirmLink } from './support/api';
import { expect, test } from './support/fixtures';
import { field, id, ownerOn, staffOn } from './support/ui';

async function confirmedHow(email: string): Promise<string | null> {
  const { data } = await admin.from('email_confirmations').select('how').eq('email', email).maybeSingle();
  return data?.how ?? null;
}

test('a new owner is signed straight in, and the link is sent at once', async ({ page }) => {
  const email = `confirm-new-${Date.now()}@e2e.test`;
  const since = Date.now();
  await page.goto('/sign-up');
  await field(page, 'name').fill('New Owner');
  await field(page, 'email').fill(email);
  await field(page, 'password').fill('Owner1234!');
  await id(page, 'sign-up-submit').click();
  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 30_000 });
  // Signed in, but the address is not confirmed until the link is opened.
  expect(await confirmedHow(email)).toBeNull();
  await page.goto(await openedConfirmLink(email, since));
  await expect.poll(() => confirmedHow(email), { timeout: 20_000 }).toBe('link');
});

test('on a slow phone too: the link confirms when the app starts after the sign-in was taken from the address', async ({ page }) => {
  // Start-up can finish before the app listens; the sign-in then arrives as INITIAL_SESSION (it failed this way once
  // under load). Chrome running 8× slower makes that happen every time.
  const email = `confirm-slow-${Date.now()}@e2e.test`;
  const since = Date.now();
  await page.goto('/sign-up');
  await field(page, 'name').fill('Slow Phone');
  await field(page, 'email').fill(email);
  await field(page, 'password').fill('Owner1234!');
  await id(page, 'sign-up-submit').click();
  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 30_000 });
  const link = await openedConfirmLink(email, since);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
  await page.goto(link);
  await expect.poll(() => confirmedHow(email), { timeout: 30_000 }).toBe('link');
});

test('until the link is opened, Home asks and a plan cannot be bought; the link confirms', async ({ page, mode }) => {
  const owner = await createOwner(mode, { plan: false, emailConfirmed: false });
  await ownerOn(page, mode, owner.email, owner.password);
  await expect(id(page, 'confirm-email-banner')).toContainText(`Confirm your email: we sent a link to ${owner.email}.`);

  // The Plan page says why, and the ways to pay are off (the database refuses them too).
  await page.goto('/plan');
  await expect(id(page, 'plan-confirm-email')).toContainText('Confirm your email to buy a plan');
  await expect(id(page, 'plan-request')).toBeDisabled();

  // "Resend", then the link from the inbox.
  const since = Date.now();
  await id(page, 'plan-confirm-email-resend').click();
  await expect(id(page, 'plan-confirm-email-sent')).toHaveText('Sent. Check your inbox, and your spam folder too.');
  await page.goto(await openedConfirmLink(owner.email, since));
  await expect(id(page, 'tab-index')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => confirmedHow(owner.email), { timeout: 20_000 }).toBe('link');

  await page.goto('/plan');
  await expect(id(page, 'plan-request')).toBeEnabled();
  await expect(id(page, 'plan-confirm-email')).toHaveCount(0);
  await id(page, 'plan-request').click();
  await expect(id(page, 'plan-requested')).toBeVisible();
});

test('× hides the banner until the next day; staff never see it', async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { emailConfirmed: false });
  const cashier = await createStaff(owner, 'cashier');
  await ownerOn(page, mode, owner.email, owner.password);
  await expect(id(page, 'confirm-email-banner')).toBeVisible();
  await id(page, 'confirm-email-close').click();
  await expect(id(page, 'confirm-email-banner')).toHaveCount(0);

  // Still hidden today, once the app has asked again.
  const asked = page.waitForResponse((r) => r.url().includes('/rpc/confirm_my_email'));
  await page.reload();
  await asked;
  await expect(id(page, 'tab-index')).toBeVisible();
  await expect(id(page, 'confirm-email-banner')).toHaveCount(0);

  // Closed on an earlier day: back again.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('confirmEmail.closedOn.')) localStorage.setItem(key, '2000-01-01');
    }
  });
  await page.reload();
  await expect(id(page, 'confirm-email-banner')).toBeVisible({ timeout: 30_000 });

  // Staff: never asked.
  const till = await device();
  let asks = 0;
  till.on('request', (r) => {
    if (r.url().includes('/rpc/confirm_my_email')) asks++;
  });
  await staffOn(till, mode, owner.code, cashier.username, cashier.password);
  await expect(id(till, 'tab-index')).toBeVisible();
  await expect(id(till, 'confirm-email-banner')).toHaveCount(0);
  expect(asks).toBe(0);
});

test('a new password from the emailed code confirms the address too', async ({ page, mode }) => {
  const owner = await createOwner(mode, { emailConfirmed: false });
  await page.goto('/forgot-password');
  await field(page, 'email').fill(owner.email);
  await id(page, 'forgot-send').click();
  const code = await latestCode(owner.email);
  await field(page, 'code').fill(code);
  await field(page, 'password').fill('NewPass123!');
  await field(page, 'confirm').fill('NewPass123!');
  await id(page, 'forgot-reset').click();
  await expect(id(page, 'tab-index')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => confirmedHow(owner.email), { timeout: 20_000 }).toBe('link');
  await expect(id(page, 'confirm-email-banner')).toHaveCount(0);
});
