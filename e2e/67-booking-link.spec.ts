/**
 * The booking link, shared (owner's fix list D, 2026-10-31): the page shows the salon's logo and address (D2); a link the
 * owner changes keeps the old address working, sending visitors on to the new one (D3), and no other salon can take it.
 * Links changed before old links were kept are found again in the salon's Activity (1 Nov). The link preview itself
 * (D1) and the website's redirect are drawn by the website's server functions: api/_lib/bookingPreview.test.ts and
 * api/booking-preview.test.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { admin, createOwner } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, tab, text } from './support/ui';

test('visitors see the salon’s logo and address on its booking page', async ({ device, mode }) => {
  const owner = await createOwner(mode);
  const logoPath = `${owner.businessId}/${owner.branchId}-0a1b2c3d.png`;
  const { error: upload } = await admin.storage
    .from('logos')
    .upload(logoPath, readFileSync(join(__dirname, 'fixtures/logo.png')), { contentType: 'image/png' });
  expect(upload).toBeNull();
  await admin.from('branches').update({ logo_path: logoPath, address: 'Shop 4, Al Barsha 1, Dubai' }).eq('id', owner.branchId);
  const { data: slug, error } = await owner.client.rpc('set_online_booking', { p_branch: owner.branchId, p_on: true });
  expect(error).toBeNull();

  const visitor = await device();
  await visitor.goto(`/b/${slug}`);
  await expect(id(visitor, 'booking-address')).toHaveText('Shop 4, Al Barsha 1, Dubai');
  const logo = id(visitor, 'booking-logo').locator('img');
  await expect(logo).toHaveAttribute('src', new RegExp(`/logos/${logoPath}$`));
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test('a changed booking link: the old one still brings visitors to the salon, and stays the salon’s', async ({ page, device, mode }) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-branch').click();
  await id(page, 'online-booking-switch').click();
  await expect(text(page, 'Online booking is on')).toBeVisible();
  const { data: branch } = await admin.from('branches').select('booking_slug').eq('id', owner.branchId).single();
  const old = branch!.booking_slug!;
  const next = `${old.slice(0, 30)}-new`;
  await id(page, 'online-booking-change').click();
  await expect(id(page, 'online-booking-old-link')).toHaveText('Your old link keeps working: it sends people to the new one.');
  await id(page, 'online-booking-slug').fill(next);
  await id(page, 'online-booking-save-link').click();
  await expect(text(page, 'Link saved')).toBeVisible();
  await expect(id(page, 'online-booking-link')).toHaveText(`saloqo.com/b/${next}`);

  // Someone with the old link, e.g. from an Instagram bio.
  const visitor = await device();
  await visitor.goto(`/b/${old}`);
  await expect(visitor).toHaveURL(new RegExp(`/b/${next}$`));
  await expect(id(visitor, 'booking-salon')).toBeVisible();

  // Another salon cannot take it over.
  const other = await createOwner(mode);
  const { error } = await other.client.rpc('set_online_booking', { p_branch: other.branchId, p_on: true, p_slug: old });
  expect(error?.message).toContain('link_taken');

  // Switched off, neither link opens the page.
  expect((await owner.client.rpc('set_online_booking', { p_branch: owner.branchId, p_on: false })).error).toBeNull();
  const later = await device();
  await later.goto(`/b/${old}`);
  await expect(text(later, 'This booking page is not available. The salon may have switched it off.')).toBeVisible();
  await expect(later).toHaveURL(new RegExp(`/b/${old}$`));
});

test('a link changed before old links were kept still brings visitors to the salon; a link no salon had says so', async ({ device, mode }) => {
  const owner = await createOwner(mode);
  const { data: first, error } = await owner.client.rpc('set_online_booking', { p_branch: owner.branchId, p_on: true });
  expect(error).toBeNull();
  // As Red Rose's was on 31 Oct: the link changed, with only the Activity to show for it.
  const now = `${first.slice(0, 30)}-now`;
  expect((await admin.from('branches').update({ booking_slug: now }).eq('id', owner.branchId)).error).toBeNull();
  expect((await admin.from('booking_old_links').delete().eq('branch_id', owner.branchId)).error).toBeNull();
  const activity = { business_id: owner.businessId, branch_id: owner.branchId, action: 'update', entity_type: 'branch', entity_id: owner.branchId };
  expect((await admin.from('audit_log').insert({ ...activity, summary: `Online booking on: ${now}` })).error).toBeNull();
  const found = await admin.rpc('backfill_booking_old_links');
  expect(found.error).toBeNull();
  expect(found.data).toBeGreaterThan(0);

  const visitor = await device();
  await visitor.goto(`/b/${first}`);
  await expect(visitor).toHaveURL(new RegExp(`/b/${now}$`));
  await expect(id(visitor, 'booking-salon')).toBeVisible();

  await visitor.goto(`/b/never-was-${Date.now() % 100_000}`);
  await expect(text(visitor, "We can't find a booking page at this link. Check the link, or ask the salon for its booking link.")).toBeVisible();
  await expect(text(visitor, 'This booking page is not available. The salon may have switched it off.')).toHaveCount(0);
});
