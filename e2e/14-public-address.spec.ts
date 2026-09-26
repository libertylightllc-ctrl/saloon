/**
 * On a public web address without a hosted database the site shows "being set up" — on every path —
 * instead of a sign-in that cannot work. The same build on this Mac still runs against the local stack.
 */
import { expect, test } from './support/fixtures';
import { id, snap } from './support/ui';

test.use({ launchOptions: { args: ['--host-resolver-rules=MAP live.salon.test 127.0.0.1'] } });

test('a public address with no hosted database shows "being set up", never a sign-in', async ({ page, baseURL, mode }) => {
  const port = new URL(baseURL!).port;
  for (const path of ['/', '/sign-in', '/accounts']) {
    await page.goto(`http://live.salon.test:${port}${path}`);
    await expect(id(page, 'setting-up')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Salon Control is being set up')).toBeVisible();
    await expect(id(page, 'sign-in-submit')).toHaveCount(0);
  }
  await snap(page, 'setting-up', mode);
  await page.goto(`http://localhost:${port}/`);
  await expect(id(page, 'welcome-gents')).toBeVisible({ timeout: 30_000 });
});
