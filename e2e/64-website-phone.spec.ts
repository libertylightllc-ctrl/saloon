/**
 * The home page on a phone (owner's fix list round 2, Part B, from a check of the live site on 28 Oct 2026: 10,041 px
 * tall at 390 px wide, the pilot form starting at 6,575 px). The pilot right after the hero for UAE visitors; the plans
 * in one sideways row and every feature behind a button; three comparison rows and six questions, the rest behind a
 * button; three sections the rest of the page repeats left out (computers keep the page as it was); a WhatsApp button
 * and footer link once Console → Settings → Contact has a number (final brief A4). The page: 6,500 px or less.
 */
import { readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';

import { expect, test } from './support/fixtures';
import { useSite } from './support/site';

const site = useSite(8300);

const NUMBER = '+971500000001';
const MESSAGE = "Hi Saloqo, I'd like to know more about the pilot for my salon.";
const DEMO = "Hi, I'd like a quick demo of Saloqo for my salon.";
const waTo = (text: string) => `https://wa.me/971500000001?text=${encodeURIComponent(text)}`;

/**
 * The home page with a WhatsApp number in Console → Settings → Contact (the live one has none yet): rendered as the
 * build does, with the pilot on, and opened at http://wa.test/ (its pictures and fonts are left out). `built`: the
 * number the build read; `now`: the one the database has when the page opens (the page reads it from http://api.test).
 */
async function withWhatsApp(page: Page, lang = 'en', { built = NUMBER, now }: { built?: string; now?: string } = {}) {
  const { renderPage } = await import('../scripts/site/page.mjs');
  const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
  const brand = read('src/config/brand.json');
  const config = { ...read('src/config/site.json'), supportEmail: brand.supportEmail };
  const pilot = { max: 20, days: 90, places_left: 16 };
  const contact = { whatsapp_number: built, whatsapp_message: MESSAGE };
  const api = now === undefined ? null : { url: 'http://api.test', key: 'public' };
  const html = renderPage({ root: process.cwd(), lang, row: null, pilot, contact, api, brand, site: config, supabase: {}, year: 2026 });
  await page.route('http://wa.test/**', (route) =>
    route.request().resourceType() === 'document' ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort(),
  );
  await page.route('http://api.test/**', (route) =>
    route.request().url().endsWith('/rpc/site_contact')
      ? route.fulfill({ json: { whatsapp_number: now, whatsapp_message: MESSAGE } })
      : route.abort(),
  );
  await page.goto(`http://wa.test/${lang === 'en' ? '' : lang}`);
}

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

  test('the page is 6,500 px tall or less; the sections the features, sign-up and FAQ repeat are left out', async ({ page }) => {
    await page.goto(`${site()}/`);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(6500);
    for (const part of ['section.owners', 'section.steps', 'section.trust-band']) await expect(page.locator(part)).toBeHidden();
    await expect(page.locator('details[data-faq="data"]')).toHaveCount(1);
  });

  test('A4: no WhatsApp number in Console → Settings, no WhatsApp button or link; "Contact us" opens the contact page', async ({ page }) => {
    await page.goto(`${site()}/`);
    await expect(page.locator('a[href*="wa.me"]').filter({ visible: true })).toHaveCount(0);
    await expect(page.locator('footer a:visible', { hasText: 'Contact us' })).toHaveAttribute('href', '/contact');
  });

  test('A4: with a number, a round WhatsApp button bottom right and a footer link, both with the saved message', async ({ page }) => {
    await withWhatsApp(page);
    const button = page.locator('a.floating:visible');
    await expect(button).toHaveCount(1);
    await expect(button).toHaveAttribute('href', waTo(MESSAGE));
    const box = (await button.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(390 - 40);
    expect(box.y + box.height).toBeGreaterThan(844 - 40);
    await expect(page.locator('footer a:visible', { hasText: 'WhatsApp us' })).toHaveAttribute('href', waTo(MESSAGE));
    await expect(page.locator('footer a:visible', { hasText: 'Contact us' })).toHaveAttribute('href', waTo(MESSAGE));
  });

  test('A4: a number saved after the build shows when the page opens; one taken away hides the buttons', async ({ page }) => {
    await withWhatsApp(page, 'en', { built: '', now: NUMBER });
    await expect(page.locator('a.floating')).toBeVisible();
    await expect(page.locator('a.floating')).toHaveAttribute('href', waTo(MESSAGE));
    // "Book a demo" keeps its own message.
    await expect(page.locator('a[data-event="cta_book_demo"]')).toHaveAttribute('href', waTo(DEMO));

    await withWhatsApp(page, 'en', { built: NUMBER, now: '' });
    await expect(page.locator('a.floating')).toBeHidden();
    await expect(page.locator('footer a:visible', { hasText: 'Contact us' })).toHaveAttribute('href', '/contact');
  });

  test('A4: in Arabic the WhatsApp button sits bottom left', async ({ page }) => {
    await withWhatsApp(page, 'ar');
    const box = (await page.locator('a.floating:visible').boundingBox())!;
    expect(box.x).toBeLessThan(40);
  });
});

test.describe('on a computer in the UAE', () => {
  test.use({ viewport: { width: 1280, height: 800 }, timezoneId: 'Asia/Dubai' });

  test('B2–B4: as before: the three plans side by side, every feature, comparison row, question and section, no buttons', async ({ page }) => {
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
    for (const part of ['section.owners', 'section.steps', 'section.trust-band']) await expect(page.locator(part)).toBeVisible();
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

  test('A4: the WhatsApp button and footer link open with the same saved message', async ({ page }) => {
    await withWhatsApp(page);
    await expect(page.locator('a.floating:visible')).toHaveAttribute('href', waTo(MESSAGE));
    await expect(page.locator('footer a:visible', { hasText: 'WhatsApp us' })).toHaveAttribute('href', waTo(MESSAGE));
  });
});
