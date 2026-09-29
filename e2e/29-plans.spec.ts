/** Paid plans: a new salon is set up but locked until the platform owner records a payment; it opens at once. */
import { createOwner, createStaff, makePlatformAdmin } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap, staffOn, tab, text } from './support/ui';

test('owner asks for the plan; the platform owner records the payment; the salon opens', async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { plan: false });
  const cashier = await createStaff(owner, 'cashier');
  const platform = await createOwner(mode);
  await makePlatformAdmin(platform.email);

  // No plan: Home says so, and new work is refused with a clear message.
  await ownerOn(page, mode, owner.email, owner.password);
  await expect(id(page, 'plan-banner')).toContainText('Switch on your plan');
  await expect(id(page, 'plan-banner')).toContainText('AED 99.00');
  await tab(page, 'queue');
  await id(page, 'queue-new').click();
  await id(page, `pick-service-${SERVICE[mode].name}`).click();
  await id(page, 'appointment-submit').click();
  await expect(text(page, /plan isn’t active/)).toBeVisible();

  // The cashier sees why.
  const till = await device();
  await staffOn(till, mode, owner.code, cashier.username, cashier.password);
  await expect(id(till, 'plan-banner')).toContainText('Ask the owner');
  await tab(till, 'more');
  await expect(id(till, 'more-plan')).toHaveCount(0);

  // The owner asks for 3 months.
  await page.goto('/plan');
  await expect(id(page, 'plan-status')).toContainText('Not active');
  await id(page, 'plan-months-3').click();
  await expect(id(page, 'plan-total')).toContainText('AED 297.00');
  await id(page, 'plan-note').fill('Paying by bank transfer');
  await id(page, 'plan-request').click();
  await expect(id(page, 'plan-requested')).toContainText('3 month');
  await snap(page, 'plan', mode);

  // The platform owner sees the request and records the payment.
  const office = await device();
  await ownerOn(office, mode, platform.email, platform.password);
  await tab(office, 'more');
  await id(office, 'more-admin').click();
  await expect(id(office, `admin-salon-${owner.code}`)).toContainText('Paying by bank transfer');
  await id(office, `admin-salon-${owner.code}`).click();
  await expect(id(office, 'admin-amount')).toHaveValue('297.00');
  await id(office, 'admin-note').fill('Bank transfer ref 4411');
  await id(office, 'admin-activate').click();
  await expect(id(office, `admin-salon-${owner.code}`)).toContainText('Until');
  await snap(office, 'admin-salons', mode);

  // The salon opens on every phone without a reload.
  await expect(id(page, 'plan-status')).toContainText('Active');
  await expect(id(till, 'plan-banner')).toHaveCount(0);
  await page.goto('/queue');
  await id(page, 'queue-new').click();
  await id(page, `pick-service-${SERVICE[mode].name}`).click();
  await id(page, 'appointment-submit').click();
  await expect(text(page, /plan isn’t active/)).toHaveCount(0);

  // Only the platform owner has the admin screen.
  await tab(page, 'more');
  await expect(id(page, 'more-admin')).toHaveCount(0);
});
