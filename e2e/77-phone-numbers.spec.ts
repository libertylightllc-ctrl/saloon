/** Owner's app check F1, in a Qatar salon: Branch settings refuses "000000000"; numbers typed the local way are saved
 * with +974; a customer is found by their number however it is typed, and the booking page finds them again. */
import { admin, createOwner, type Country } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { field, id, ownerOn, snap, text } from './support/ui';

const QATAR: Country = { country_code: 'QA', currency: 'QAR', timezone: 'Asia/Qatar', tax_name: 'VAT', tax_rate_bps: 0 };
const qatarDay = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Qatar' }).format(new Date(Date.now() + n * 86_400_000));

test('phone numbers in a Qatar salon: checked, saved with +974, and found again', async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { country: QATAR });
  await ownerOn(page, mode, owner.email, owner.password);

  // Branch settings: not a number, then a local one.
  await page.goto('/settings/branch');
  await field(page, 'phone').fill('000000000');
  await id(page, 'branch-save').click();
  await expect(text(page, /That isn't a full phone number/)).toBeVisible();
  await snap(page, 'phone-not-a-number', mode);
  await field(page, 'phone').fill('4444 1234');
  await id(page, 'branch-save').click();
  await expect(text(page, 'Settings saved')).toBeVisible();
  const { data: branch } = await admin.from('branches').select('phone').eq('id', owner.branchId).single();
  expect(branch!.phone).toBe('+974 4444 1234');

  // A customer typed the local way gets +974, and is found by the number with or without it.
  await page.goto('/customers/form');
  await field(page, 'name').fill('Red Rose Client');
  await field(page, 'phone').fill('12');
  await id(page, 'customer-save').click();
  await expect(text(page, /That isn't a full phone number/)).toBeVisible();
  await field(page, 'phone').fill('55512345');
  await id(page, 'customer-save').click();
  await expect(text(page, '+974 5551 2345')).toBeVisible();
  const { data: customer } = await admin.from('customers').select('id, phone').eq('business_id', owner.businessId).eq('name', 'Red Rose Client').single();
  expect(customer!.phone).toBe('+974 5551 2345');
  for (const typed of ['55512345', '+974 5551 2345']) {
    await page.goto('/customers');
    await id(page, 'customers-search').fill(typed);
    await expect(id(page, 'customer-Red Rose Client')).toBeVisible();
  }

  // The booking page: the same client types their number the local way and is found, not added again.
  const { data: slug, error } = await owner.client.rpc('set_online_booking', { p_branch: owner.branchId, p_on: true });
  if (error) throw error;
  const visitor = await device();
  await visitor.goto(`/b/${slug as string}`);
  await expect(id(visitor, 'booking-call')).toBeVisible();
  await id(visitor, `booking-service-${SERVICE[mode].name}`).click();
  await id(visitor, `booking-day-${qatarDay(2)}`).click();
  await id(visitor, 'booking-time-12:00').click();
  await id(visitor, 'field-name').fill('Rose');
  await id(visitor, 'field-phone').fill('000000000');
  await id(visitor, 'booking-submit').click();
  await expect(text(visitor, /That isn't a full phone number/)).toBeVisible();
  await id(visitor, 'field-phone').fill('5551 2345');
  await id(visitor, 'booking-submit').click();
  await expect(visitor).toHaveURL(/\/booking\/[A-Za-z0-9_-]{24}$/);
  const { data: booked } = await admin.from('appointments').select('customer_id').eq('branch_id', owner.branchId).eq('source', 'app').single();
  expect(booked!.customer_id).toBe(customer!.id);
  const { count } = await admin.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', owner.businessId);
  expect(count).toBe(1);
});
