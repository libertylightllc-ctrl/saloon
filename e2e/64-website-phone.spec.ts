/**
 * The home page on a phone (owner's fix list round 2, Part B, from a check of the live site on 28 Oct 2026: 10,041 px
 * tall at 390 px wide, the pilot form starting at 6,575 px). The pilot right after the hero for UAE visitors.
 */
import { expect, test } from './support/fixtures';
import { useSite } from './support/site';

const site = useSite(8300);

test.describe('on a phone in the UAE', () => {
  test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Dubai', locale: 'en-US' });

  test('B1: the pilot comes right after the hero, within the first 3 screens; the bar\'s "Apply" goes to it', async ({ page }) => {
    await page.goto(`${site()}/`);
    await expect(page.locator('#pilot')).toBeVisible();
    expect(await page.evaluate(() => document.querySelector('main')!.firstElementChild!.id)).toBe('pilot');
    const top = await page.locator('#pilot').evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    expect(top).toBeLessThan(2 * 844);
    await page.locator('.pilot-bar a[href="#pilot"]').click();
    await expect(page.locator('[data-pilot-form] [name="name"]')).toBeInViewport();
  });
});

test.describe('on a phone outside the UAE', () => {
  test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/London', locale: 'en-GB' });

  test('B1: no pilot anywhere; after the hero comes "Already on a booking app? Keep it." as before', async ({ page }) => {
    await page.goto(`${site()}/`);
    await expect(page.locator('#pilot')).toBeHidden();
    await expect(page.locator('.pilot-bar')).toBeHidden();
    await expect(page.locator('main > section:visible').first()).toHaveClass(/keep/);
  });
});
