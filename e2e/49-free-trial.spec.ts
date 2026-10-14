/**
 * The 7-day free trial (owner, 2026-10-14): a new salon works at once without paying; the owner sees the days left and
 * is told the day before it ends; then the salon locks like an ended plan until the platform owner records a payment.
 */
import { fromZonedTime } from 'date-fns-tz';

import { admin, createOwner, createStaff, makePlatformAdmin } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { id, ownerOn, staffOn, tab, text } from './support/ui';

test('a new salon works free for 7 days; the owner is told before it ends; then it locks until paid', async ({
  page,
  mode,
  device,
}) => {
  const owner = await createOwner(mode, { plan: 'trial' });
  const cashier = await createStaff(owner, 'cashier');
  const platform = await createOwner(mode);
  await makePlatformAdmin(platform.email);
  const { data: sub } = await admin.from('subscriptions').select('paid_until, trial').eq('business_id', owner.businessId).single();
  expect(sub?.trial).toBe(true);

  // Home shows the days left; work is saved straight away.
  await ownerOn(page, mode, owner.email, owner.password);
  await expect(id(page, 'plan-trial')).toContainText('Free trial: 7 days left');
  await expect(id(page, 'plan-banner')).toHaveCount(0);
  await tab(page, 'queue');
  await id(page, 'queue-new').click();
  await id(page, `pick-service-${SERVICE[mode].name}`).click();
  await id(page, 'appointment-submit').click();
  await expect(id(page, 'queue-new')).toBeVisible();
  await expect(text(page, /plan isn’t active/)).toHaveCount(0);

  // The plan page says it is the trial, and offers to switch the plan on.
  await page.goto('/plan');
  await expect(id(page, 'plan-status')).toContainText('Free trial');
  await expect(id(page, 'plan-status-line')).toContainText('Free trial: 7 days left, until');
  await expect(text(page, 'Switch on your plan', true)).toBeVisible();

  // Staff are not bothered with it.
  const till = await device();
  await staffOn(till, mode, owner.code, cashier.username, cashier.password);
  await expect(id(till, 'tab-index')).toBeVisible();
  await expect(id(till, 'plan-trial')).toHaveCount(0);
  await expect(id(till, 'plan-banner')).toHaveCount(0);

  // The platform owner sees a trial, not a paying salon.
  const office = await device();
  await ownerOn(office, mode, platform.email, platform.password);
  await tab(office, 'more');
  await id(office, 'more-admin').click();
  await id(office, 'console-tab-salons').click();
  await expect(id(office, `admin-salon-${owner.code}`)).toContainText('Trial until');

  // The day before it ends (from 09:00 salon time) the owner is told.
  const { data: biz } = await admin.from('businesses').select('timezone').eq('id', owner.businessId).single();
  const dayBefore = new Date(`${sub!.paid_until}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const at = fromZonedTime(`${dayBefore.toISOString().slice(0, 10)}T10:00:00`, biz!.timezone).toISOString();
  const { error } = await admin.rpc('notify_trials_ending', { p_now: at });
  expect(error).toBeNull();
  await page.goto('/notifications');
  await expect(id(page, 'notification-trial_ending')).toContainText('Your free trial ends tomorrow');
  await id(page, 'notification-trial_ending').click();
  await expect(id(page, 'plan-status')).toBeVisible();

  // It ends: new work is refused, everything saved stays, and the owner is shown how to go on.
  await admin.from('subscriptions').update({ paid_until: '2026-01-01' }).eq('business_id', owner.businessId);
  await expect(id(page, 'plan-status')).toContainText('Not active');
  await expect(id(page, 'plan-status-line')).toContainText('Your free trial ended on 1 January 2026');
  await page.goto('/');
  await expect(id(page, 'plan-banner')).toContainText('Your free trial has ended');
  await expect(id(till, 'plan-banner')).toContainText('Ask the owner');
  await page.goto('/queue');
  await expect(id(page, 'queue-new')).toBeVisible();
  await id(page, 'queue-new').click();
  await id(page, `pick-service-${SERVICE[mode].name}`).click();
  await id(page, 'appointment-submit').click();
  await expect(text(page, /plan isn’t active/)).toBeVisible();

  // The platform owner records a payment: the salon opens on every phone, as a paid plan.
  await id(office, `admin-salon-${owner.code}`).click();
  await id(office, 'admin-note').fill('Bank transfer ref 7001');
  await id(office, 'admin-activate').click();
  await expect(id(office, `admin-salon-${owner.code}`)).toContainText('Until');
  await expect(id(office, `admin-salon-${owner.code}`)).not.toContainText('Trial');
  await expect(id(till, 'plan-banner')).toHaveCount(0);
  await page.goto('/plan');
  await expect(id(page, 'plan-status')).toContainText('Active');
  await expect(id(page, 'plan-status-line')).toContainText('Paid until');
});
