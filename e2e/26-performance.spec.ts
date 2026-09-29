/** Performance: a salon with 1,200 customers — the list draws only what is on screen and loads more as you scroll. */
import { admin, createOwner } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, tab } from './support/ui';

const COUNT = 1_200;

test('1,200 customers: the list stays light and scrolls to the last one; the report shows 200 and exports all', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const rows = Array.from({ length: COUNT }, (_, i) => ({
    business_id: owner.businessId,
    name: `Perf ${String(i + 1).padStart(4, '0')}`,
    phone: `+971 55 ${String(1_000_000 + i).slice(0, 3)} ${String(1_000_000 + i).slice(3)}`,
  }));
  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await admin.from('customers').insert(rows.slice(i, i + 400));
    if (error) throw error;
  }

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'customers');
  await expect(id(page, 'customer-Perf 0001')).toBeVisible();
  // Only a window of rows is in the page, not all 1,200.
  const drawn = await page.locator('[data-testid^="customer-Perf"]').count();
  expect(drawn).toBeLessThan(120);

  // Scrolling to the end keeps loading pages until the last customer.
  const list = id(page, 'customers-list');
  await expect
    .poll(
      async () => {
        await list.evaluate((el) => {
          const scroller = [el, ...el.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 10 && getComputedStyle(e).overflowY !== 'visible');
          if (scroller) scroller.scrollTop = scroller.scrollHeight;
        });
        return page.locator('[data-testid="customer-Perf 1200"]').count();
      },
      { timeout: 90_000, intervals: [250] },
    )
    .toBe(1);
  expect(await page.locator('[data-testid^="customer-Perf"]').count()).toBeLessThan(200);

  // The customer report draws the first 200 rows and says the export has all of them.
  await page.goto('/reports?type=customers');
  await expect(id(page, 'report-more')).toContainText(`200 of ${COUNT}`);
  const [file] = await Promise.all([page.waitForEvent('download'), id(page, 'report-csv').click()]);
  const { readFileSync } = await import('node:fs');
  const csv = readFileSync((await file.path())!, 'utf8').trim().split('\r\n');
  expect(csv.length).toBe(COUNT + 1);
});
