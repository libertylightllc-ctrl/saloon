/** Changing the salon's country after setup (owner, 2026-10-06): allowed until money is recorded. The owner moves a
 * new UAE salon to Kazakhstan from Branch settings — tenge, Almaty time, VAT 16%, starter prices converted — and once
 * money is recorded the country is fixed. */
import { admin, createOwner, sellCustom } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap, text } from './support/ui';

test('the owner changes the country before any money is recorded; after a sale it is fixed', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const { data: before } = await admin.from('services').select('id, price_minor').eq('business_id', owner.businessId).order('price_minor').limit(1).single();
  await ownerOn(page, mode, owner.email, owner.password);
  await page.goto('/settings/branch');
  await expect(id(page, 'branch-country')).toContainText('AED');

  await id(page, 'branch-country-change').click();
  await id(page, 'setup-country-search').fill('Kazakh');
  await id(page, 'setup-country-KZ').click();
  await expect(id(page, 'setup-country-picked')).toContainText('KZT');
  await snap(page, 'change-country-sheet', mode);
  await id(page, 'branch-country-save').click();
  await expect(text(page, 'Country changed')).toBeVisible();
  await expect(id(page, 'branch-country')).toContainText('KZT · Asia/Almaty');
  await id(page, 'branch-country').scrollIntoViewIfNeeded();
  await snap(page, 'change-country-done', mode);

  const { data: biz } = await admin.from('businesses').select('country_code, currency, timezone').eq('id', owner.businessId).single();
  expect(biz).toEqual({ country_code: 'KZ', currency: 'KZT', timezone: 'Asia/Almaty' });
  const { data: br } = await admin.from('branches').select('tax_rate_bps').eq('id', owner.branchId).single();
  expect(Number(br!.tax_rate_bps)).toBe(1600);
  const { data: after } = await admin.from('services').select('price_minor').eq('id', before!.id).single();
  expect(after!.price_minor).toBeGreaterThan(before!.price_minor * 100); // tenge, not the same number of dirhams

  // A sale is money recorded: the country is fixed from now on.
  await sellCustom(owner.client, owner, { cash: 500_000 });
  await page.reload();
  await expect(id(page, 'branch-country-locked')).toBeVisible({ timeout: 30_000 });
  await expect(id(page, 'branch-country-change')).toHaveCount(0);
});
