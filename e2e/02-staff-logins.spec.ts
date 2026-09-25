import { createOwner, createStaff } from './support/api';
import { uid } from './support/env';
import { expect, test, THEME } from './support/fixtures';
import { expectTheme, field, id, ownerOn, snap, staffOn, tab, text, visibleTabs } from './support/ui';

test('owner creates a cashier login; the cashier sees cashier tabs in the branch theme', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const other = mode === 'gents' ? 'ladies' : 'gents';

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await expect(id(page, 'more-salon-code')).toContainText(owner.code);
  await id(page, 'more-team').click();
  await expect(id(page, 'team-salon-code')).toHaveText(owner.code);
  await id(page, 'team-new').click();

  const username = `cash${uid().slice(-6)}`;
  await id(page, 'create-login').click();
  await expect(text(page, 'Required').first()).toBeVisible();
  await field(page, 'display_name').fill('Faisal Cashier');
  await id(page, 'role-cashier').click();
  await field(page, 'username').fill(username);
  await field(page, 'password').fill('Cash1234!');
  await id(page, 'create-login').click();
  await expect(id(page, `member-${username}`)).toBeVisible();

  // Same username again is refused with a clear message.
  await id(page, 'team-new').click();
  await field(page, 'display_name').fill('Someone Else');
  await field(page, 'username').fill(username);
  await field(page, 'password').fill('Cash1234!');
  await id(page, 'create-login').click();
  await expect(id(page, 'form-error')).toContainText('That username is taken');
  await page.keyboard.press('Escape');

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
  await staffOn(page, mode, owner.code, staff.username, staff.password);
  await expectTheme(page, mode);
  expect(await visibleTabs(page)).toEqual(['index', 'queue', 'more']);
  await expect(id(page, 'kpi-expected-cash')).toHaveCount(0);
  await tab(page, 'more');
  await expect(id(page, 'more-sales')).toHaveCount(0);
  await expect(id(page, 'more-services')).toBeVisible();
});
