/**
 * No opening and closing times (owner, 2026-10-07: "remove the opening and closing time"): bookings any time of an
 * open day, late at night included; the owner changes the open days in Branch settings and a closed day offers none.
 */
import { admin, createOwner, dubaiDate } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, tab, text } from './support/ui';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

test('bookings any time of an open day; a day closed in Branch settings offers no times', async ({
  page,
  mode,
}) => {
  const owner = await createOwner(mode);
  const date = dubaiDate(2);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  await ownerOn(page, mode, owner.email, owner.password);

  // From midnight to the last half hour: no opening and closing times.
  await tab(page, 'queue');
  await id(page, 'queue-new').click();
  await id(page, 'appt-kind-booking').click();
  await id(page, `date-${date}`).click();
  await expect(id(page, 'slot-00:00')).toBeVisible();
  await expect(id(page, 'slot-23:30')).toBeVisible();

  // Closed that day: Branch settings → Open days.
  await page.goto('/settings/branch');
  await id(page, `open-day-${DAYS[weekday]}`).click();
  await id(page, 'branch-save').click();
  await expect(text(page, 'Settings saved')).toBeVisible();
  const { data } = await admin
    .from('branches')
    .select('opening_hours')
    .eq('id', owner.branchId)
    .single();
  expect((data?.opening_hours as { days: number[] }).days).toEqual(
    [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== weekday),
  );

  await page.goto('/queue');
  await id(page, 'queue-new').click();
  await id(page, 'appt-kind-booking').click();
  await id(page, `date-${date}`).click();
  await expect(text(page, 'No free times this day. Try another day.')).toBeVisible();
  await expect(id(page, 'slot-12:00')).toHaveCount(0);
});
