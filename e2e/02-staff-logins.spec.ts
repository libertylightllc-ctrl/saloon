import { admin, createOwner, createStaff } from './support/api';
import { uid } from './support/env';
import { expect, test, THEME } from './support/fixtures';
import { expectTheme, id, idStarts, ownerOn, snap, staffOn, tab, text, visibleTabs } from './support/ui';

test('owner creates a cashier login; the cashier sees cashier tabs in the branch theme', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const other = mode === 'gents' ? 'ladies' : 'gents';

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await expect(id(page, 'more-salon-code')).toContainText(owner.code);
  // Staff is the one place for people and their logins: added with their job and a login in one form.
  await id(page, 'more-staff').click();
  await expect(id(page, 'team-salon-code')).toHaveText(owner.code);
  await id(page, 'staff-add').click();
  const username = `cash${uid().slice(-6)}`;
  await id(page, 'staff-name').fill('Faisal Cashier');
  await id(page, 'staff-title-cashier').click();
  await id(page, 'staff-can-login').click();
  await expect(id(page, 'role-cashier')).toHaveAttribute('aria-selected', 'true');
  await expect(id(page, 'staff-save')).toBeDisabled();
  await id(page, 'login-username').fill(username);
  await id(page, 'login-password').fill('Cash1234!');
  await id(page, 'staff-save').click();
  await expect(text(page, `Faisal Cashier saved, with login ${username}`)).toBeVisible();
  await expect(id(page, 'staff-login-card')).toContainText(`@${username}`);

  // Same username again is refused with a clear message; the person is kept and Save again adds only the login.
  await page.goto('/staff/form');
  await id(page, 'staff-name').fill('Someone Else');
  await id(page, 'staff-can-login').click();
  await id(page, 'login-username').fill(username);
  await id(page, 'login-password').fill('Cash1234!');
  await id(page, 'staff-save').click();
  await expect(id(page, 'form-error')).toContainText('That username is taken');
  await expect(text(page, /Someone Else is saved/)).toBeVisible();
  await id(page, 'login-username').fill(`${username}x`);
  await id(page, 'staff-save').click();
  await expect(id(page, 'staff-login-card')).toContainText(`@${username}x`);
  const { count } = await admin.from('employees').select('id', { count: 'exact', head: true }).eq('business_id', owner.businessId).eq('full_name', 'Someone Else');
  expect(count).toBe(1);

  // The cashier's phone picked the other salon type; the branch's type wins after sign-in.
  const phone = await device();
  await staffOn(phone, other, owner.code, username, 'Cash1234!');
  await expectTheme(phone, mode);
  expect(await visibleTabs(phone)).toEqual(['index', 'queue', 'sale', 'customers', 'more']);
  await tab(phone, 'more');
  await expect(id(phone, 'more-sales')).toBeVisible();
  await expect(id(phone, 'more-team')).toHaveCount(0);
  await expect(id(phone, 'more-branch')).toHaveCount(0);
  await expect(id(phone, 'more-salon-code')).toHaveCount(0);
  // Wording follows the branch too.
  await tab(phone, 'queue');
  await id(phone, 'queue-new').click();
  await expect(text(phone, THEME[mode].anyStaff)).toBeVisible();
  await snap(phone, 'cashier-new-walkin', mode);
});

test('a staff login sees only its own tabs and no money', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 30_000 });
  const staff = await createStaff(owner, 'staff');
  // A visit in progress: staff may start visits, but Complete (checkout) is for people who take payment.
  const { data: visit } = await owner.client.rpc('create_appointment', {
    p: { branch_id: owner.branchId, kind: 'walk_in', guest_name: 'Walk-in guest', service_ids: [] },
  });
  await owner.client.rpc('start_service', { p_id: visit as string });
  await staffOn(page, mode, owner.code, staff.username, staff.password);
  await expectTheme(page, mode);
  expect(await visibleTabs(page)).toEqual(['index', 'queue', 'pay', 'more']);
  await expect(id(page, 'kpi-expected-cash')).toHaveCount(0);
  await tab(page, 'queue');
  await expect(idStarts(page, 'queue-row-')).toContainText('Walk-in guest');
  await expect(idStarts(page, 'queue-complete-')).toHaveCount(0);
  await idStarts(page, 'queue-more-').click();
  await expect(page.getByRole('button', { name: 'Complete', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  // Hidden tabs cannot be opened by address either.
  for (const path of ['/sale', '/customers', '/sales', '/settings/team']) {
    await page.goto(path);
    await expect(id(page, 'tab-index')).toHaveAttribute('aria-selected', 'true');
  }
  await tab(page, 'more');
  await expect(id(page, 'more-sales')).toHaveCount(0);
  await expect(id(page, 'more-services')).toBeVisible();
});
