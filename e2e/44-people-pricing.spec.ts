/**
 * The plan is priced by people, per salon (owner, 2026-10-08): AED 50 a month covers up to 4 people who sign in (the
 * owner and staff logins); each one after that adds AED 10; branches cost nothing extra.
 */
import { createOwner, createStaff, makePlatformAdmin } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, text } from './support/ui';

test('5 people sign in: AED 60 a month; a new login says what it adds; the console asks for the same', async ({
  page,
  mode,
  device,
}) => {
  const owner = await createOwner(mode, { plan: false });
  for (const role of ['staff', 'staff', 'cashier', 'accountant'] as const)
    await createStaff(owner, role);

  // The plan page: the monthly price and how it is made up.
  await ownerOn(page, mode, owner.email, owner.password);
  await page.goto('/plan');
  await expect(id(page, 'plan-price')).toHaveText('AED 60.00');
  await expect(id(page, 'plan-people')).toHaveText('5 people sign in: you and your staff logins');
  await expect(
    text(page, 'AED 50.00 covers up to 4 people; each extra person adds AED 10.00 a month.', false),
  ).toBeVisible();

  // Adding one more login says what it adds.
  await page.goto('/staff/form');
  await id(page, 'staff-name').fill('Omar Barber');
  await id(page, 'staff-can-login').click();
  await expect(id(page, 'login-plan-note')).toHaveText(
    'Your plan covers 4 people and 5 already sign in, so this login adds AED 10.00 a month.',
  );

  // The owner asks for 3 months; the platform owner's console proposes 3 × AED 60.
  await page.goto('/plan');
  await id(page, 'plan-months-3').click();
  await expect(text(page, 'Total: AED 180.00')).toBeVisible();
  await id(page, 'plan-request').click();
  await expect(id(page, 'plan-requested')).toContainText('3 month(s)');

  const platform = await createOwner(mode);
  await makePlatformAdmin(platform.email);
  const office = await device();
  await ownerOn(office, mode, platform.email, platform.password);
  await office.goto('/console');
  await id(office, 'console-tab-salons').click();
  await id(office, 'console-salon-search').fill(owner.code);
  await expect(id(office, `admin-salon-${owner.code}`)).toContainText(
    '5 people sign in · AED 60.00 a month',
  );
  await id(office, `admin-salon-${owner.code}`).click();
  await expect(id(office, 'admin-amount')).toHaveValue('180.00');
});
