/** Staff & attendance: the owner sets pay terms and a roster; the barber/stylist clocks in late from Home and
 * the board flags it; the owner records someone who has no phone; cashiers see attendance but never pay. */
import { createOwner, createStaff } from './support/api';
import { expect, test } from './support/fixtures';
import { back, expectMoney, id, ownerOn, staffOn, tab, text } from './support/ui';

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Dubai clock now: weekday key and minutes since midnight. */
function dubaiNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { day: get('weekday').slice(0, 3).toLowerCase(), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

test('owner sets pay and a roster; the barber clocks in late from Home; the board shows it', async ({ page, mode, device }) => {
  const now = dubaiNow();
  // The shift started 45 minutes ago. In the first 45 minutes after midnight that is last night's shift, which
  // runs past midnight.
  const overnight = now.minutes < 45;
  const shiftDay = overnight ? WEEKDAYS[(WEEKDAYS.indexOf(now.day) + 6) % 7]! : now.day;
  const start = hhmm((now.minutes - 45 + 1440) % 1440);
  const end = overnight ? '06:00' : '23:59';
  const owner = await createOwner(mode);
  const barber = await createStaff(owner, 'staff');
  expect(WEEKDAYS).toContain(now.day);

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-staff').click();
  await id(page, `staff-${barber.name}`).click();
  await id(page, 'staff-edit').click();
  await id(page, 'staff-salary').fill('3500');
  await id(page, 'staff-commission').fill('15');
  await id(page, 'staff-code').fill('E-014');
  await id(page, 'staff-wps').click();
  await id(page, 'staff-save').click();
  await expect(text(page, 'Staff saved')).toBeVisible();
  await expectMoney(page, 'staff-detail-salary', 350_000);
  await expect(id(page, 'staff-detail-commission')).toHaveText('15%');

  await id(page, 'staff-roster-edit').click();
  await id(page, `roster-${shiftDay}`).click();
  await id(page, `roster-${shiftDay}-start`).fill(start);
  await id(page, `roster-${shiftDay}-end`).fill(end);
  await id(page, 'roster-save').click();
  await expect(text(page, 'Roster saved')).toBeVisible();
  await expect(id(page, 'staff-roster')).toContainText(`${start}–${end}`);
  await back(page);

  // Someone without the app.
  await id(page, 'staff-add').click();
  await id(page, 'staff-name').fill('Sameer Khan');
  await id(page, 'staff-salary').fill('3000');
  await id(page, 'staff-save').click();
  await expect(text(page, 'Staff saved')).toBeVisible();
  await back(page);
  await expect(id(page, 'staff-Sameer Khan')).toContainText('No login');
  await expectMoney(page, 'staff-salaries-value', 650_000);

  // The barber clocks in from Home: 45 minutes after the shift start → late.
  const phone = await device();
  await staffOn(phone, mode, owner.code, barber.username, barber.password);
  await expect(id(phone, 'clock-card')).toContainText(`${start}–${end}`);
  await id(phone, 'clock-in').click();
  await expect(text(phone, /Clocked in — 4\d min late/)).toBeVisible();
  await expect(id(phone, 'clock-card')).toContainText('Late');
  await expect(id(phone, 'clock-out')).toBeVisible();

  // The owner's board: the barber is in and late; the owner records Sameer.
  await id(page, 'staff-attendance').click();
  await expect(id(page, `attendance-${barber.name}`)).toContainText('In');
  await expect(id(page, `attendance-${barber.name}`)).toContainText('Late');
  await id(page, 'attendance-Sameer Khan-in').click();
  await id(page, 'attendance-confirm').click();
  await expect(text(page, 'Sameer Khan clocked in')).toBeVisible();
  await expect(id(page, 'attendance-Sameer Khan')).toContainText('In');

  // The barber clocks out; the day shows done.
  await id(phone, 'clock-out').click();
  await expect(text(phone, 'Clocked out. See you tomorrow!')).toBeVisible();
  await expect(id(phone, 'clock-card')).toContainText('Your day is done.');
  await expect(id(page, `attendance-${barber.name}`)).toContainText('Done');
});

test('cashier records attendance but never sees pay; staff see only their own day', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const cashier = await createStaff(owner, 'cashier');
  const barber = await createStaff(owner, 'staff');

  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  await tab(page, 'more');
  await expect(id(page, 'more-staff')).toHaveCount(0);
  await id(page, 'more-attendance').click();
  await id(page, `attendance-${barber.name}-in`).click();
  await id(page, 'attendance-confirm').click();
  await expect(text(page, `${barber.name} clocked in`)).toBeVisible();
  await page.goto('/staff');
  await expect(id(page, 'tab-index')).toHaveAttribute('aria-selected', 'true');
  await expect(id(page, 'clock-card')).toBeVisible(); // the cashier clocks too

  const phone = await device();
  await staffOn(phone, mode, owner.code, barber.username, barber.password);
  await expect(id(phone, 'clock-out')).toBeVisible(); // already clocked in by the cashier
  await tab(phone, 'more');
  await expect(id(phone, 'more-attendance')).toHaveCount(0);
  await expect(id(phone, 'more-staff')).toHaveCount(0);
});
