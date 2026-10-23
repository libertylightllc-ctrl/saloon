/**
 * The booking page, fuller (website brief 5.1, 2026-10-23): the owner adds a cover photo and the salon's Instagram in
 * Branch settings → Online booking; a visitor sees them with the salon's open days, a map link, and a small "Free
 * booking page by Saloqo" link that brings other salon owners to the website.
 */
import path from 'node:path';

import { admin, createOwner } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap, tab, text } from './support/ui';

const PHOTO = path.join(__dirname, 'fixtures', 'receipt.jpg');

test('the owner adds a cover photo and Instagram; visitors see them, the open days and where the page comes from', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-branch').click();
  await id(page, 'online-booking-switch').click();
  await expect(text(page, 'Online booking is on')).toBeVisible();

  // Cover photo: shrunk, kept in the salon's own folder.
  const chooser = page.waitForEvent('filechooser');
  await id(page, 'booking-cover-add').click();
  await (await chooser).setFiles(PHOTO);
  await expect(text(page, 'Cover photo saved')).toBeVisible();
  await expect(id(page, 'booking-cover-preview')).toBeVisible();
  const { data: branch } = await admin.from('branches').select('cover_path, booking_slug').eq('id', owner.branchId).single();
  expect(branch!.cover_path).toMatch(new RegExp(`^${owner.businessId}/cover-${owner.branchId}-[0-9a-f]{8}\\.jpg$`));

  // Instagram: a profile link is kept as the handle; something else is refused with a reason.
  await id(page, 'booking-instagram').fill('not a handle!');
  await id(page, 'booking-instagram-save').click();
  await expect(text(page, 'Enter your Instagram handle: letters, numbers, dots and underscores.')).toBeVisible();
  await id(page, 'booking-instagram').fill('https://www.instagram.com/e2e.salon/');
  await id(page, 'booking-instagram-save').click();
  await expect(text(page, 'Instagram saved')).toBeVisible();
  await expect(id(page, 'booking-instagram')).toHaveValue('@e2e.salon');
  await snap(page, 'booking-profile-settings', mode);

  // Open Monday to Saturday.
  await admin.from('branches').update({ opening_hours: { days: [1, 2, 3, 4, 5, 6] } }).eq('id', owner.branchId);

  const visitor = await device();
  await visitor.goto(`/b/${branch!.booking_slug}`);
  await expect(id(visitor, 'booking-cover')).toBeVisible();
  await expect(id(visitor, 'booking-open-days')).toHaveText('Open Mon–Sat');
  await expect(id(visitor, 'booking-instagram-link')).toHaveAttribute('href', 'https://www.instagram.com/e2e.salon/');
  await expect(id(visitor, 'booking-directions')).toBeVisible();
  await expect(id(visitor, 'booking-powered-by')).toHaveText('Free booking page by Saloqo');
  await expect(id(visitor, 'booking-powered-by')).toHaveAttribute('href', `https://www.saloqo.com/?ref=booking&salon=${branch!.booking_slug}`);
  await snap(visitor, 'booking-page-extras', mode);

  // The owner takes the photo off.
  await id(page, 'booking-cover-remove').click();
  await expect(text(page, 'Cover photo removed')).toBeVisible();
  await visitor.reload();
  await expect(id(visitor, 'booking-salon')).toBeVisible();
  await expect(id(visitor, 'booking-cover')).toHaveCount(0);
});
