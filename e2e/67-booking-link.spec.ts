/**
 * The booking link, shared (owner's fix list D, 2026-10-31): the page shows the salon's logo and address (D2).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { admin, createOwner } from './support/api';
import { expect, test } from './support/fixtures';
import { id } from './support/ui';

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
