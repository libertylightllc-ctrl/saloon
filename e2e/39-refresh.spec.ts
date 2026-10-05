/** A refresh button (owner, 2026-10-05): on the web — and the app saved to a phone's home screen, which has no browser
 * reload — it reloads the app, picking up the newest version and fresh data, and the person stays signed in. */
import { createOwner } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, tab } from './support/ui';

test('Refresh reloads the app from Home and from More, still signed in', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  await page.evaluate(() => ((window as unknown as { beforeRefresh: boolean }).beforeRefresh = true));
  await Promise.all([page.waitForEvent('load'), id(page, 'app-refresh').click()]);
  await expect(id(page, 'home-greeting')).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => (window as unknown as { beforeRefresh?: boolean }).beforeRefresh)).toBeUndefined();

  await tab(page, 'more');
  await Promise.all([page.waitForEvent('load'), id(page, 'more-refresh').click()]);
  await expect(id(page, 'more-refresh')).toBeVisible({ timeout: 30_000 });
});
