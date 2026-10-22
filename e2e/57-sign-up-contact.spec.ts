/**
 * The owner's mobile / WhatsApp number (website brief 3.3, 2026-10-22): optional on sign-up with the country code of
 * where the visitor is (a searchable list to change it), "We'll only use it to help you set up", an unticked
 * "OK to message me on WhatsApp"; kept with the time of the OK. Someone who gave none (as Google sign-ups do) is asked
 * once, in setup's first step.
 */
import { admin } from './support/api';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { chooseType, field, id } from './support/ui';

async function contactOf(email: string) {
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = users.users.find((u) => u.email === email)!;
  const { data } = await admin.from('owner_contacts').select('phone, whatsapp_ok, whatsapp_ok_at, source').eq('user_id', user.id).maybeSingle();
  return data;
}

async function signUp(page: import('@playwright/test').Page, email: string) {
  await field(page, 'name').fill('Contact Owner');
  await field(page, 'email').fill(email);
  await field(page, 'password').fill('Owner1234!');
}

test('an owner gives a WhatsApp number at sign-up and says OK; setup does not ask again', async ({ page, mode }) => {
  const email = `contact-${uid()}@e2e.test`;
  await chooseType(page, mode);
  await id(page, 'link-sign-up').click();
  // In Dubai: +971, changeable from a list.
  await expect(id(page, 'field-phone-code')).toHaveText(/\+971/);
  await expect(page.getByText('We’ll only use it to help you set up.')).toBeVisible();
  await expect(id(page, 'sign-up-whatsapp-ok')).toHaveAttribute('aria-checked', 'false');
  await id(page, 'field-phone-code').click();
  await id(page, 'phone-code-search').fill('india');
  await id(page, 'phone-code-IN').click();
  await expect(id(page, 'field-phone-code')).toHaveText(/\+91/);
  await id(page, 'field-phone-code').click();
  await id(page, 'phone-code-search').fill('emirates');
  await id(page, 'phone-code-AE').click();
  await field(page, 'phone').fill('050 123 4567');
  await id(page, 'sign-up-whatsapp-ok').click();
  await signUp(page, email);
  await id(page, 'sign-up-submit').click();

  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 30_000 });
  await expect(field(page, 'ownerPhone')).toHaveCount(0);
  const contact = await contactOf(email);
  expect(contact).toMatchObject({ phone: '+971501234567', whatsapp_ok: true, source: 'sign_up' });
  expect(contact!.whatsapp_ok_at).toBeTruthy();
});

test('an owner who gave no number is asked once, in setup', async ({ page, mode }) => {
  const email = `nocontact-${uid()}@e2e.test`;
  await chooseType(page, mode);
  await id(page, 'link-sign-up').click();
  await field(page, 'phone').fill('123');
  await signUp(page, email);
  await id(page, 'sign-up-submit').click();
  await expect(page.getByText('Enter the number: 6 to 14 digits.')).toBeVisible();
  await field(page, 'phone').fill('');
  await id(page, 'sign-up-submit').click();

  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 30_000 });
  expect(await contactOf(email)).toBeNull();
  await expect(field(page, 'ownerPhone')).toBeVisible();
  await field(page, 'businessName').fill(`Contact ${mode} salon`);
  await field(page, 'ownerPhone').fill('0509876543');
  await id(page, 'setup-next').click();
  await id(page, 'setup-next').click(); // country: UAE
  await id(page, 'setup-next').click(); // salon type, picked on the home page
  await field(page, 'branchName').fill('Main');
  await id(page, 'setup-next').click();
  await id(page, 'setup-next').click(); // create
  await expect(id(page, 'tab-index')).toBeVisible({ timeout: 30_000 });
  expect(await contactOf(email)).toMatchObject({ phone: '+971509876543', whatsapp_ok: false, source: 'setup' });
});
