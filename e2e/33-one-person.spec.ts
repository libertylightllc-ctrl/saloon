/**
 * One person, one record (owner, 2026-09-30): Staff is the one place for people, pay and logins. A login is added
 * with the person or later from their page, always on their own record; an outside accountant has a login only.
 */
import { admin, createOwner } from './support/api';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap, text } from './support/ui';

async function records(businessId: string, name: string) {
  const { data } = await admin.from('employees').select('member_id, base_salary_minor').eq('business_id', businessId).eq('full_name', name);
  return data ?? [];
}

test('one person, one record: pay and login added together, a login added later, and a login-only accountant', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);

  // Added with pay and a login in one form.
  await page.goto('/staff/form');
  await id(page, 'staff-name').fill('Omar Cashier');
  await id(page, 'staff-title-cashier').click();
  await id(page, 'staff-salary').fill('2500');
  await id(page, 'staff-can-login').click();
  const omar = `omar${uid().slice(-6)}`;
  await id(page, 'login-username').fill(omar);
  await id(page, 'login-password').fill('Cash1234!');
  await snap(page, 'staff-add-with-login', mode);
  await id(page, 'staff-save').click();
  await expect(id(page, 'staff-login-card')).toContainText(`@${omar}`);
  await expect(id(page, 'staff-login-card')).toContainText('Cashier');
  const o = await records(owner.businessId, 'Omar Cashier');
  expect(o).toHaveLength(1);
  expect(o[0]!.member_id).not.toBeNull();
  expect(o[0]!.base_salary_minor).toBe(250_000);

  // Added without a login, then given one from their page: still one record.
  await page.goto('/staff/form');
  await id(page, 'staff-name').fill('Sameer Khan');
  await id(page, 'staff-salary').fill('3000');
  await id(page, 'staff-save').click();
  await expect(id(page, 'staff-login-card')).toContainText('No app login');
  await id(page, 'staff-create-login').click();
  await expect(text(page, 'Login for Sameer Khan')).toBeVisible();
  const sameer = `sam${uid().slice(-6)}`;
  await id(page, 'login-username').last().fill(sameer);
  await id(page, 'login-password').last().fill('Staff1234!');
  await snap(page, 'staff-create-login', mode);
  await id(page, 'create-login').click();
  await expect(id(page, 'staff-login-card')).toContainText(`@${sameer}`);
  await expect(id(page, 'staff-create-login')).toHaveCount(0);
  const s = await records(owner.businessId, 'Sameer Khan');
  expect(s).toHaveLength(1);
  expect(s[0]!.member_id).not.toBeNull();
  expect(s[0]!.base_salary_minor).toBe(300_000);

  // An outside accountant: a login only, listed after the staff.
  await page.goto('/staff/form');
  await id(page, 'staff-who-accountant').click();
  await id(page, 'staff-name').fill('Nadia Accounts');
  const nadia = `nadia${uid().slice(-6)}`;
  await id(page, 'login-username').fill(nadia);
  await id(page, 'login-password').fill('Books1234!');
  await id(page, 'staff-save').click();
  await expect(id(page, `member-${nadia}`)).toContainText('Accountant');
  expect(await records(owner.businessId, 'Nadia Accounts')).toHaveLength(0);

  // The list shows each person once, with their login; Team & logins is gone (old links land here).
  await expect(id(page, 'staff-Sameer Khan')).toHaveCount(1);
  await expect(id(page, 'staff-Sameer Khan')).toContainText(`Login: ${sameer}`);
  await expect(id(page, 'staff-Omar Cashier')).toContainText(`Login: ${omar}`);
  await page.goto('/more');
  await expect(id(page, 'more-team')).toHaveCount(0);
  await page.goto('/settings/team');
  await expect(page).toHaveURL(/\/staff$/);
});
