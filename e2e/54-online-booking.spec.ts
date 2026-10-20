/**
 * The salon's online booking link (owner, 2026-10-20: "start with number one, online booking link"): the owner
 * switches it on in Branch settings and gets saloqo.com/b/<link>; a visitor on another phone — no account, no app —
 * picks a service, a day and a free time, gives a name and number and is booked; the booking lands with the salon
 * (booked online, the owner told); the visitor can cancel from their booking page; switched off, the page is gone.
 */
import { admin, createOwner } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap, tab, text } from './support/ui';

/** A date n days from now in Dubai, as the page names its day chips. */
const dubaiDay = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date(Date.now() + n * 86_400_000));

test('a visitor books online with a name and number; the salon is told; the visitor cancels', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-branch').click();
  await expect(id(page, 'online-booking')).toContainText('No commission.');
  await id(page, 'online-booking-switch').click();
  await expect(text(page, 'Online booking is on')).toBeVisible();
  const { data: branch } = await admin.from('branches').select('booking_slug').eq('id', owner.branchId).single();
  const slug = branch!.booking_slug!;
  await expect(id(page, 'online-booking-link')).toHaveText(`saloqo.com/b/${slug}`);
  // The owner picks a shorter link.
  const mine = `${slug.slice(0, 30)}-cuts`;
  await id(page, 'online-booking-change').click();
  await id(page, 'online-booking-slug').fill(mine);
  await id(page, 'online-booking-save-link').click();
  await expect(text(page, 'Link saved')).toBeVisible();
  await expect(id(page, 'online-booking-link')).toHaveText(`saloqo.com/b/${mine}`);
  await snap(page, 'online-booking-settings', mode);

  // A visitor on their own phone: no sign-in.
  const visitor = await device();
  await visitor.goto(`/b/${mine}`);
  await expect(id(visitor, 'booking-salon')).toBeVisible();
  await expect(id(visitor, 'booking-submit')).toBeDisabled();
  await id(visitor, `booking-service-${SERVICE[mode].name}`).click();
  await expect(id(visitor, 'booking-summary')).toContainText('1 service');
  const day = dubaiDay(2);
  await id(visitor, `booking-day-${day}`).click();
  await id(visitor, 'booking-time-12:00').click();
  await id(visitor, 'field-name').fill('Omar Visitor');
  await id(visitor, 'field-phone').fill('+971 50 765 4321');
  await snap(visitor, 'online-booking-page', mode);
  await id(visitor, 'booking-submit').click();

  await expect(visitor).toHaveURL(/\/booking\/[A-Za-z0-9_-]{24}$/);
  await expect(id(visitor, 'my-booking')).toContainText('You’re booked');
  await expect(id(visitor, 'my-booking')).toContainText(SERVICE[mode].name);
  await expect(id(visitor, 'booking-whatsapp')).toBeVisible();
  await snap(visitor, 'online-booking-done', mode);

  // With the salon: booked online, by a new customer with that number; the owner is told.
  const { data: booked } = await admin
    .from('appointments')
    .select('status, source, customer_name, customers(phone)')
    .eq('branch_id', owner.branchId)
    .eq('source', 'app')
    .single();
  expect(booked).toMatchObject({ status: 'booked', source: 'app', customer_name: 'Omar Visitor', customers: { phone: '+971 50 765 4321' } });
  await page.goto('/notifications');
  await expect(text(page, 'New online booking')).toBeVisible();

  // The visitor cancels from their booking page; the owner is told.
  await id(visitor, 'booking-cancel').click();
  await id(visitor, 'booking-cancel-confirm').click();
  await expect(id(visitor, 'my-booking')).toContainText('Cancelled');
  await expect(id(visitor, 'booking-cancel')).toHaveCount(0);
  const { data: after } = await admin.from('appointments').select('status').eq('branch_id', owner.branchId).eq('source', 'app').single();
  expect(after!.status).toBe('cancelled');
  await page.reload();
  await expect(text(page, 'Online booking cancelled')).toBeVisible();

  // Switched off: the page is gone.
  await page.goto('/settings/branch');
  await id(page, 'online-booking-switch').click();
  await expect(text(page, 'Online booking is off')).toBeVisible();
  await visitor.goto(`/b/${mine}`);
  await expect(text(visitor, 'This booking page is not available. The salon may have switched it off.')).toBeVisible();
});
