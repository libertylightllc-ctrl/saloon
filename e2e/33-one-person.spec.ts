/**
 * One person, one record (owner, 2026-09-30): someone added in Staff & payroll gets their login on the same record,
 * from their page or by picking them in Team & logins; never a second copy of them.
 */
import { admin, createOwner } from './support/api';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { field, id, ownerOn, snap, text } from './support/ui';

async function records(businessId: string, name: string) {
  const { data } = await admin.from('employees').select('member_id, base_salary_minor').eq('business_id', businessId).eq('full_name', name);
  return data ?? [];
}

test('a person added in Staff & payroll gets their login on the same record, from their page or from Team & logins', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);

  // Added in Staff & payroll with a salary, then given a login from their page.
  await page.goto('/staff/form');
  await expect(text(page, /After saving, give them a login on their page/)).toBeVisible();
  await id(page, 'staff-name').fill('Sameer Khan');
  await id(page, 'staff-salary').fill('3000');
  await id(page, 'staff-save').click();
  await id(page, 'staff-create-login').click();
  await expect(text(page, 'Login for Sameer Khan')).toBeVisible();
  const sameer = `sam${uid().slice(-6)}`;
  await field(page, 'username').fill(sameer);
  await field(page, 'password').fill('Staff1234!');
  await snap(page, 'staff-create-login', mode);
  await id(page, 'create-login').click();
  await expect(text(page, `Login: ${sameer}`)).toBeVisible();
  await expect(id(page, 'staff-create-login')).toHaveCount(0);
  const s = await records(owner.businessId, 'Sameer Khan');
  expect(s).toHaveLength(1);
  expect(s[0]!.member_id).not.toBeNull();
  expect(s[0]!.base_salary_minor).toBe(300_000);

  // Added in Staff & payroll, then picked in Team & logins (Sameer, who has a login now, is not offered).
  await owner.client.rpc('save_employee', {
    p: { business_id: owner.businessId, branch_id: owner.branchId, full_name: 'Omar Cashier', role_title: 'cashier', base_salary_minor: 250_000 },
  });
  await page.goto('/settings/team');
  await id(page, 'team-new').click();
  await expect(id(page, 'login-for-Sameer Khan')).toHaveCount(0);
  await id(page, 'login-for-Omar Cashier').click();
  await expect(id(page, 'role-cashier')).toHaveAttribute('aria-selected', 'true');
  const omar = `omar${uid().slice(-6)}`;
  await field(page, 'username').fill(omar);
  await field(page, 'password').fill('Cash1234!');
  await id(page, 'create-login').click();
  await expect(id(page, `member-${omar}`)).toBeVisible();
  const o = await records(owner.businessId, 'Omar Cashier');
  expect(o).toHaveLength(1);
  expect(o[0]!.member_id).not.toBeNull();
  expect(o[0]!.base_salary_minor).toBe(250_000);

  // The staff list shows each of them once, with their login.
  await page.goto('/staff');
  await expect(id(page, 'staff-Sameer Khan')).toHaveCount(1);
  await expect(id(page, 'staff-Sameer Khan')).toContainText(`Login: ${sameer}`);
  await expect(id(page, 'staff-Omar Cashier')).toContainText(`Login: ${omar}`);
});
