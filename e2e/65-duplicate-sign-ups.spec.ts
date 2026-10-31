/**
 * Duplicate sign-ups (owner's fix list, final brief C4): an address that already has an account is sent to sign in or
 * "Forgot password?" instead of making a second account; a number an open salon already has is asked about ("Sign in
 * instead?"), and the visitor may still go on.
 */
import { admin, createOwner } from './support/api';
import { expect, test } from './support/fixtures';
import { field, id } from './support/ui';

// The number check allows 10 questions an hour from one address, and every test here comes from this computer.
test.beforeEach(async () => {
  await admin.from('phone_checks').delete().gte('created_at', '2000-01-01');
});

test('an email that already has an account is sent to sign in or "Forgot password?"', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  await page.goto('/sign-up');
  await field(page, 'name').fill('Second Try');
  await field(page, 'email').fill(owner.email.toUpperCase());
  await field(page, 'password').fill('Another1234!');
  await id(page, 'sign-up-submit').click();
  const done = id(page, 'sign-up-already-registered');
  await expect(done).toContainText('This email already has an account');
  await expect(id(page, 'sign-up-to-reset')).toHaveText('Forgot password?');
  await id(page, 'sign-up-to-reset').click();
  await expect(page).toHaveURL(/\/forgot-password/);
});

test('a number an open salon already has is asked about; the visitor may sign in instead or go on', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const local = `50${String(Date.now()).slice(-7)}`;
  const { data: me } = await owner.client.auth.getUser();
  const { error } = await admin.from('owner_contacts').insert({ user_id: me.user!.id, phone: `+971${local}`, source: 'setup' });
  if (error) throw error;

  const fill = async () => {
    await field(page, 'name').fill('Same Number');
    await field(page, 'email').fill(`same-number-${Date.now()}@e2e.test`);
    await field(page, 'password').fill('Owner1234!');
    await field(page, 'phone').fill(`0${local}`);
  };
  await page.goto('/sign-up');
  await fill();
  await id(page, 'sign-up-submit').click();
  await expect(id(page, 'sign-up-phone-taken')).toHaveText(/This number already has a salon on Saloqo\. Sign in instead\?/);
  await id(page, 'sign-up-phone-sign-in').click();
  await expect(page).toHaveURL(/\/sign-in/);

  // Asked again; a changed number hides the question, and "Continue anyway" makes the account.
  await page.goto('/sign-up');
  await fill();
  await id(page, 'sign-up-submit').click();
  await expect(id(page, 'sign-up-phone-taken')).toBeVisible();
  await field(page, 'phone').fill('0509990001');
  await expect(id(page, 'sign-up-phone-taken')).toHaveCount(0);
  await field(page, 'phone').fill(`0${local}`);
  await expect(id(page, 'sign-up-phone-taken')).toBeVisible();
  await id(page, 'sign-up-phone-continue').click();
  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 30_000 });
});
