/**
 * The free period and the pilot (full update, Phase 6; this was the 7-day trial's test). With billing on (as for every
 * browser test): a new salon works at once; the owner sees nothing about paying until the last 14 days, then how long
 * is left (staff never); a pilot code makes it a pilot salon; the platform owner ends it from the console: new work is
 * refused, everything stays, the owner is shown the way on; a recorded payment opens it again. Billing off is in the
 * SQL tests (35), as switching it here would change every other test running.
 */
import { format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

import { admin, createOwner, createStaff, makePlatformAdmin } from './support/api';
import { SERVICE } from './support/catalog';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { id, ownerOn, staffOn, tab, text } from './support/ui';

const daysFromToday = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

test('a new salon is free to start; the last 14 days are counted down; a pilot code; ended and paid from the console', async ({
  page,
  mode,
  device,
}) => {
  const owner = await createOwner(mode, { plan: 'trial' });
  const cashier = await createStaff(owner, 'cashier');
  const platform = await createOwner(mode);
  await makePlatformAdmin(platform.email);
  const { data: sub } = await admin.from('subscriptions').select('access_type, free_until').eq('business_id', owner.businessId).single();
  expect(sub?.access_type).toBe('trial');

  // Plenty of free time: no banner, work is saved at once, and the plan page is only a note — no price, no plan.
  await ownerOn(page, mode, owner.email, owner.password);
  await expect(id(page, 'tab-index')).toBeVisible();
  await expect(id(page, 'plan-trial')).toHaveCount(0);
  await expect(id(page, 'plan-banner')).toHaveCount(0);
  await tab(page, 'queue');
  await id(page, 'queue-new').click();
  await id(page, `pick-service-${SERVICE[mode].name}`).click();
  await id(page, 'appointment-submit').click();
  await expect(id(page, 'queue-new')).toBeVisible();
  await page.goto('/plan');
  await expect(id(page, 'plan-status-line')).toContainText('Free until');
  await expect(id(page, 'plan-price')).toHaveCount(0);
  await expect(id(page, 'plan-request')).toHaveCount(0);
  await expect(text(page, /7 days/)).toHaveCount(0);

  // The last 14 days: the owner is counted down on Home; staff are not told.
  await admin.from('subscriptions').update({ free_until: daysFromToday(10) }).eq('business_id', owner.businessId);
  await page.goto('/');
  await expect(id(page, 'plan-trial')).toContainText('days of free time left');
  const till = await device();
  await staffOn(till, mode, owner.code, cashier.username, cashier.password);
  await expect(id(till, 'tab-index')).toBeVisible();
  await expect(id(till, 'plan-trial')).toHaveCount(0);
  await expect(id(till, 'plan-banner')).toHaveCount(0);

  // A pilot code from the Saloqo team, typed in any letter case: a pilot salon for the code's days.
  const code = `PILOT-E2E-${uid().slice(-6).toUpperCase()}`;
  await admin.from('pilot_codes').insert({ code, days: 90, max_uses: 1 });
  await page.goto('/plan');
  await id(page, 'plan-pilot-open').click();
  await id(page, 'plan-pilot-code').fill('NOT-A-CODE');
  await id(page, 'plan-pilot-use').click();
  await expect(id(page, 'plan-pilot-refused')).toContainText('That code isn’t right');
  await id(page, 'plan-pilot-code').fill(code.toLowerCase());
  await id(page, 'plan-pilot-use').click();
  await expect(id(page, 'plan-status-line')).toContainText('Pilot salon · free until');
  await expect(id(page, 'plan-pilot-open')).toHaveCount(0);

  // The platform owner sees the pilot and ends it: new work is refused, everything saved stays.
  const office = await device();
  await ownerOn(office, mode, platform.email, platform.password);
  await tab(office, 'more');
  await id(office, 'more-admin').click();
  await id(office, 'console-tab-salons').click();
  // The list draws 50 salons at a time; search finds this one wherever it is.
  await id(office, 'console-salon-search').fill(owner.code);
  await expect(id(office, `admin-salon-${owner.code}`)).toContainText('Pilot · until');
  // A new end date is picked on the calendar (the month of the current end opens), not typed.
  const { data: pilotSub } = await admin.from('subscriptions').select('free_until').eq('business_id', owner.businessId).single();
  const pick = `${String(pilotSub!.free_until).slice(0, 7)}-15`;
  await id(office, `admin-salon-${owner.code}`).click();
  await id(office, 'access-date').click();
  await id(office, `access-date-day-${pick}`).click();
  await id(office, 'access-set-end').click();
  await expect(id(office, `admin-salon-${owner.code}`)).toContainText(`Pilot · until ${format(new Date(`${pick}T12:00:00`), 'd MMM yyyy')}`);
  await id(office, `admin-salon-${owner.code}`).click();
  await id(office, 'access-end-now').click();
  await page.goto('/plan');
  await expect(id(page, 'plan-status-line')).toContainText('Your free time ended on');
  await expect(id(page, 'plan-price')).toBeVisible();
  await page.goto('/');
  await expect(id(page, 'plan-banner')).toContainText('Your free time has ended');
  await expect(id(till, 'plan-banner')).toContainText('Ask the owner');
  await page.goto('/queue');
  await id(page, 'queue-new').click();
  await id(page, `pick-service-${SERVICE[mode].name}`).click();
  await id(page, 'appointment-submit').click();
  await expect(text(page, /free time has ended/)).toBeVisible();

  // A recorded payment opens it again, on every phone, as a paid plan.
  await id(office, `admin-salon-${owner.code}`).click();
  await id(office, 'admin-note').fill('Bank transfer ref 7001');
  await id(office, 'admin-activate').click();
  await expect(id(office, `admin-salon-${owner.code}`)).toContainText('Paid until');
  // The plans list tells free time from paid time.
  const { data: salon } = await admin.from('businesses').select('name').eq('id', owner.businessId).single();
  await id(office, 'console-tab-plans').click();
  await expect(id(office, `plan-event-pilot-${salon!.name}`).first()).toContainText('Pilot · until');
  await expect(id(office, `plan-event-pilot-${salon!.name}`).first()).not.toContainText('Paid until');
  await expect(id(office, `plan-event-activate-${salon!.name}`).first()).toContainText('Paid until');
  await expect(id(till, 'plan-banner')).toHaveCount(0);
  await page.goto('/plan');
  await expect(id(page, 'plan-status-line')).toContainText('Paid until');

  // 14 days before a free period ends (from 09:00 salon time) the owner is told.
  const other = await createOwner(mode, { plan: 'trial' });
  const { data: biz } = await admin.from('businesses').select('timezone').eq('id', other.businessId).single();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: biz!.timezone }).format(new Date());
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 14);
  await admin.from('subscriptions').update({ free_until: end.toISOString().slice(0, 10) }).eq('business_id', other.businessId);
  const at = fromZonedTime(`${today}T10:00:00`, biz!.timezone).toISOString();
  expect((await admin.rpc('notify_trials_ending', { p_now: at })).error).toBeNull();
  const second = await device();
  await ownerOn(second, mode, other.email, other.password);
  await second.goto('/notifications');
  await expect(id(second, 'notification-trial_ending')).toContainText('Your free time ends in 14 days');
});
