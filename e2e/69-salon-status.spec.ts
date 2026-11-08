/** The console's "Ended" status (owner, 8 Nov 2026): a salon whose paid period is over is counted as ended in the
 * Overview, whose groups add up to the salon total; its card says "Ended on <date>" in place of "Paid until"; and
 * Console → Salons' status filter shows it under Ended, not under Paid or Test. */
import { admin, createOwner, makePlatformAdmin } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap } from './support/ui';

test('an ended salon is counted as ended, says "Ended on <date>", and the status filter finds it', async ({ page, mode }) => {
  const dev = await createOwner(mode);
  await makePlatformAdmin(dev.email);
  const shop = await createOwner(mode, { businessName: `Ended ${mode} ${Date.now() % 100_000}` });
  const { error } = await admin
    .from('subscriptions')
    .update({ access_type: 'paid', paid_until: '2026-01-15', free_until: null })
    .eq('business_id', shop.businessId);
  if (error) throw error;

  // The Overview: "N ended" among the groups, and the groups add up to the total.
  await ownerOn(page, mode, dev.email, dev.password);
  await page.goto('/console');
  const total = Number(await id(page, 'console-salons-value').innerText());
  const sub = await id(page, 'console-salons-sub').innerText();
  const group = (word: string) => Number(sub.match(new RegExp(`(\\d+) ${word}`))?.[1]);
  expect(group('ended')).toBeGreaterThan(0);
  expect(group('paid') + group('free') + group('pilot') + group('free for good') + group('ended')).toBe(total);
  expect(sub).toMatch(/Not counted: \d+ closed/);
  await snap(page, 'console-overview-ended', mode);

  // Console → Salons: the card, and the filter.
  await id(page, 'console-tab-salons').click();
  await id(page, 'console-salon-search').fill(shop.code);
  const row = id(page, `admin-salon-${shop.code}`);
  await expect(row).toContainText('Ended on 15 Jan 2026');
  await expect(row).not.toContainText('Paid until');
  await id(page, 'console-salon-filter-paid').click();
  await expect(row).toHaveCount(0);
  await expect(page.getByText('No salons here.')).toBeVisible();
  await id(page, 'console-salon-filter-ended').click();
  await expect(row).toBeVisible();
  await expect(id(page, 'console-salon-filter-ended')).toContainText('Ended 1');
  await snap(page, 'console-salons-ended', mode);
  await id(page, 'console-salon-filter-test').click();
  await expect(row).toHaveCount(0);
});
