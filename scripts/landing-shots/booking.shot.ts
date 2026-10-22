/**
 * The website's booking-page picture (website brief 2.6): a demo barber shop's free booking page as its customers
 * see it, with a service picked. Writes assets/images/landing/gents-booking.png (then to-webp.py → 600 × 1298 WebP).
 * Run on the local stack: npx playwright test -c scripts/landing-shots/playwright.config.ts booking
 */
import { admin, createOwner } from '../../e2e/support/api';
import { expect, test } from '../../e2e/support/fixtures';
import { id } from '../../e2e/support/ui';

test('booking page', async ({ browser }) => {
  const owner = await createOwner('gents', { businessName: 'Al Barsha Gents' });
  await admin.from('branches').update({ name: 'Al Barsha', address: 'Al Barsha 1, Dubai', phone: '+971 4 555 0123' }).eq('id', owner.branchId);
  const { data: slug, error } = await owner.client.rpc('set_online_booking', { p_branch: owner.branchId, p_on: true, p_slug: `albarsha-${owner.code}` });
  if (error) throw error;
  // A visitor's phone, not signed in.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'Asia/Dubai' });
  const page = await ctx.newPage();
  await page.goto(`/b/${slug as string}`);
  await expect(id(page, 'booking-salon')).toBeVisible();
  await id(page, 'booking-service-Haircut').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'assets/images/landing/gents-booking.png' });
  await ctx.close();
});
