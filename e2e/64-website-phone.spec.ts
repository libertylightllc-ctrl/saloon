/**
 * The home page on a phone (owner's fix list round 2, Part B, from a check of the live site on 28 Oct 2026: 10,041 px
 * tall at 390 px wide, the pilot form starting at 6,575 px). The pilot right after the hero for UAE visitors; the plans
 * in one sideways row and every feature behind a button; three comparison rows and six questions, the rest behind a
 * button (computers keep the page as it was).
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

  test('B2: the three plans are one sideways row with dots; every feature waits behind "See everything included"', async ({ page }) => {
    await page.goto(`${site()}/`);
    const plan = (months: number) => page.getByTestId(`plan-${months}`);
    await plan(1).scrollIntoViewIfNeeded();
    const [one, six] = [await plan(1).boundingBox(), await plan(6).boundingBox()];
    // Side by side, the next card's edge on screen.
    expect(six!.y).toBe(one!.y);
    expect(six!.x).toBeGreaterThan(one!.x + one!.width);
    expect(six!.x).toBeLessThan(390);
    const dots = page.locator('#pricing .dots i');
    await expect(dots).toHaveCount(3);
    await expect(dots.nth(0)).toHaveClass('on');
    await page.locator('#pricing .plans').evaluate((row) => row.scrollBy({ left: row.clientWidth }));
    await expect(dots.nth(1)).toHaveClass('on');
    await expect(plan(6)).toBeInViewport({ ratio: 0.9 });

    const list = page.locator('#pricing .feature-list');
    const button = page.locator('[data-more-btn="included"]');
    await expect(list).toBeHidden();
    await expect(button).toHaveText('See everything included');
    await expect(page.locator('#pricing')).toContainText('Stock, clock-in and daily cash closing are in every plan.');
    await button.click();
    await expect(list).toBeVisible();
    await expect(list.locator('li')).toHaveCount(11);
    await expect(button).toHaveText('Show less');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await button.click();
    await expect(list).toBeHidden();
    await expect(button).toHaveText('See everything included');
    await expect(button).toBeInViewport();
    // The calculator stays.
    await expect(page.locator('[data-calc-form]')).toBeVisible();
  });

  test('B3: the comparison shows booking commission, each extra branch and daily cash closing, then "Compare all"', async ({ page }) => {
    await page.goto(`${site()}/`);
    const rows = page.locator('section.compare tbody tr');
    await expect(rows).toHaveCount(7);
    await expect(rows.filter({ visible: true }).locator('th')).toHaveText(['Each extra branch', 'Booking commission', 'Daily cash closing']);
    const button = page.locator('[data-more-btn="compare"]');
    await expect(button).toHaveText('Compare all');
    await button.click();
    await expect(rows.filter({ visible: true })).toHaveCount(7);
    await expect(button).toHaveText('Show less');
  });

  test('B4: six questions, then "More questions" for the rest; all of them in the page and in the search engines\' FAQ', async ({ page }) => {
    await page.goto(`${site()}/`);
    const items = page.locator('details[data-faq]');
    await expect(items).toHaveCount(15);
    await expect(items.filter({ visible: true })).toHaveCount(6);
    const button = page.locator('[data-more-btn="questions"]');
    await expect(button).toHaveText('More questions');
    await button.click();
    await expect(items.filter({ visible: true })).toHaveCount(15);
    await page.locator('details[data-faq="countries"] summary').click();
    await expect(page.locator('details[data-faq="countries"] p')).toBeVisible();
    const faq = await page.evaluate(() => JSON.parse(document.getElementById('faq-jsonld')?.textContent ?? '{}'));
    expect(faq.mainEntity).toHaveLength(15);
  });
});

test.describe('on a computer in the UAE', () => {
  test.use({ viewport: { width: 1280, height: 800 }, timezoneId: 'Asia/Dubai' });

  test('B2–B4: as before: the three plans side by side, every feature, comparison row and question, no buttons', async ({ page }) => {
    await page.goto(`${site()}/`);
    const [one, twelve] = [await page.getByTestId('plan-1').boundingBox(), await page.getByTestId('plan-12').boundingBox()];
    expect(twelve!.y).toBe(one!.y);
    expect(twelve!.x + twelve!.width).toBeLessThan(1280);
    await expect(page.locator('#pricing .feature-list')).toBeVisible();
    await expect(page.locator('#pricing .dots')).toBeHidden();
    // B3, B4: every comparison row and question, no buttons.
    await expect(page.locator('section.compare tbody tr').filter({ visible: true })).toHaveCount(7);
    await expect(page.locator('details[data-faq]').filter({ visible: true })).toHaveCount(15);
    await expect(page.locator('[data-more-btn]')).toHaveCount(3);
    for (const button of await page.locator('[data-more-btn]').all()) await expect(button).toBeHidden();
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
