/** Test salons (owner's final brief E1): a platform owner marks a salon as a test salon in Console → Salons. It leaves
 * the Overview numbers (here: its country, which no other test uses), is labelled "Test" in the list, and the change
 * is in Console → Changes as a sentence. Unmarked, it is counted again. */
import { createOwner, makePlatformAdmin, type Country } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap } from './support/ui';

// A country of its own for each mode, so the two runs never count each other's salon.
const ICELAND: Country = { country_code: 'IS', currency: 'ISK', timezone: 'Atlantic/Reykjavik', tax_name: 'VSK', tax_rate_bps: 0 };
const MALTA: Country = { country_code: 'MT', currency: 'EUR', timezone: 'Europe/Malta', tax_name: 'VAT', tax_rate_bps: 0 };

test('a test salon is left out of the Overview, labelled "Test", and counted again when unmarked', async ({ page, mode }) => {
  const country = mode === 'gents' ? ICELAND : MALTA;
  const dev = await createOwner(mode);
  await makePlatformAdmin(dev.email);
  const name = `Red Rose ${mode} ${Date.now() % 100_000}`;
  const shop = await createOwner(mode, { country, businessName: name });

  await ownerOn(page, mode, dev.email, dev.password);
  await page.goto('/console');
  const countryRow = id(page, `console-country-${country.country_code}`);
  await expect(countryRow).toBeVisible();
  const before = Number((await countryRow.innerText()).match(/(\d+)\s*$/)?.[1]);
  expect(before).toBeGreaterThan(0);

  // Marked in Console → Salons, and the toast names it.
  const row = id(page, `admin-salon-${shop.code}`);
  const findSalon = async () => {
    await id(page, 'console-tab-salons').click();
    await id(page, 'console-salon-search').fill(shop.code);
    await expect(row).toBeVisible();
  };
  await findSalon();
  await expect(row).not.toContainText('Test');
  await row.click();
  await id(page, 'console-test-salon').click();
  await expect(page.getByText(`${name} is now a test salon`).first()).toBeVisible();

  // The Overview leaves it out and says so. (The salon's sheet fills a phone screen: open the console afresh.)
  await page.goto('/console');
  await expect(id(page, 'console-tests-left-out')).toContainText(/test salons? (is|are) left out of these numbers/);
  if (before === 1) await expect(countryRow).toHaveCount(0);
  else await expect(countryRow).toContainText(new RegExp(`${before - 1}\\s*$`));

  // Labelled "Test" in the list.
  await findSalon();
  await expect(row).toContainText('Test');
  await snap(page, 'console-test-salon', mode);

  // Console → Changes says what happened, as a sentence.
  await id(page, 'console-tab-audit').click();
  await expect(page.getByText(`${name}: marked as a test salon`).first()).toBeVisible();

  // Unmarked: counted again, no label.
  await findSalon();
  await row.click();
  await id(page, 'console-test-salon').click();
  await expect(page.getByText(`${name} is no longer a test salon`).first()).toBeVisible();
  await page.goto('/console');
  await expect(countryRow).toContainText(new RegExp(`${before}\\s*$`));
  await findSalon();
  await expect(row).not.toContainText('Test');
});
