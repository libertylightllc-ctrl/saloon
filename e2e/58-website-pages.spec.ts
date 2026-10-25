/**
 * The website's home page as real HTML (website brief 4.1–4.6, 2026-10-22), built by scripts/site/build.mjs and served
 * with vercel.json's rules (scripts/serve-web.mjs): search engines get the words, price and questions without
 * JavaScript; "/" opens the app for anyone signed in on the device; each language has its own address; sign-in links
 * and the hand-over to the app (salon type, language) keep working. The app itself is a stand-in page here.
 */
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './support/fixtures';

const APP = '<!doctype html><title>app</title><p id="app">the app</p>';
let dist = '';
let server: ChildProcess | null = null;
let site = '';

test.beforeAll(async ({}, info) => {
  dist = mkdtempSync(join(tmpdir(), 'saloqo-site-'));
  writeFileSync(join(dist, 'index.html'), APP);
  execFileSync('node', ['scripts/site/build.mjs', dist], { stdio: 'pipe' });
  const port = 8290 + info.workerIndex;
  site = `http://127.0.0.1:${port}`;
  server = spawn('node', ['scripts/serve-web.mjs', String(port), dist], { stdio: 'pipe' });
  await new Promise<void>((done) => server!.stdout!.once('data', () => done()));
});

test.afterAll(() => {
  server?.kill();
  rmSync(dist, { recursive: true, force: true });
});

/** Errors on the page, apart from what only Vercel answers (/api/geo, the analytics script). */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/404|Not Found|insights/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test('search engines read the words, the price and the questions without JavaScript', async ({ request }) => {
  const html = await (await request.get(`${site}/`)).text();
  expect(html).toContain('<span class="uae">Your salon, balanced to the last dirham.</span><span class="intl">Your salon, balanced to the last cent.</span>');
  expect(html).toContain('Daily cash closing');
  // Per branch, three billing lengths, whole amounts without ".00" (full update brief, Phase 2).
  for (const price of ['AED\u00a050 a month', 'AED\u00a0270 · save 10%', 'AED\u00a0500 · 2 months free', 'USD\u00a013.99 a month', 'USD\u00a075.55 · save 10%', 'USD\u00a0139.90 · 2 months free']) {
    expect(html).toContain(price);
  }
  expect(html).toContain('Try it free');
  expect(html).toContain('No auto-renewal. No contract.');
  expect(html).not.toMatch(/7[- ]day|7 days|Nothing renews/i);
  expect(html).toContain('How much does it cost?');
  expect(html).toContain('"@type":"SoftwareApplication"');
  expect(html).toContain('"@type":"FAQPage"');
  expect(html).toContain('<link rel="canonical" href="https://www.saloqo.com/">');
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  expect(html.match(/rel="alternate" hreflang=/g)).toHaveLength(8);
  // /welcome is the same page: one address for search engines. Arabic at /ar, right to left.
  const welcome = await request.get(`${site}/welcome`, { maxRedirects: 0 });
  expect([welcome.status(), welcome.headers().location]).toEqual([308, '/']);
  const ar = await (await request.get(`${site}/ar`)).text();
  expect(ar).toContain('<html lang="ar" dir="rtl">');
  expect(ar).toContain('<link rel="canonical" href="https://www.saloqo.com/ar">');
  // Signed in on this device: the app, at "/" and /welcome.
  const signedIn = { headers: { cookie: 'sq_in=1' } };
  expect(await (await request.get(`${site}/`, signedIn)).text()).toBe(APP);
  expect(await (await request.get(`${site}/welcome`, signedIn)).text()).toBe(APP);
  expect(await (await request.get(`${site}/sign-up`)).text()).toBe(APP);
  // Robots: the home pages, legal pages and booking pages; not the app.
  const robots = await (await request.get(`${site}/robots.txt`)).text();
  expect(robots).toContain('Allow: /b/');
  expect(robots).toContain('Disallow: /');
  const sitemap = await (await request.get(`${site}/sitemap.xml`)).text();
  expect(sitemap).toContain('<loc>https://www.saloqo.com/ur</loc>');
  expect(sitemap).not.toContain('/sign-in');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Dubai', locale: 'en-US' });

  test('"Try it free" stays on screen, the calculator and the questions work, a salon type goes on to the sign-up', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${site}/`);
    await expect(page.locator('h1 .uae')).toHaveText('Your salon, balanced to the last dirham.');
    await expect(page.locator('h1 .intl')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await expect(page.getByTestId('plan-6').locator('.plan-price .uae')).toHaveText('AED\u00a0270 · save 10%');
    await expect(page.getByTestId('plan-6').locator('.plan-price .intl')).toBeHidden();
    await expect(page.getByTestId('landing-per-day').locator('.uae')).toHaveText('Under AED\u00a02 a day');
    // The sticky header keeps "Try it free" on screen however far down.
    await page.mouse.move(195, 400);
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 300);
    await expect(page.locator('[data-start="header"]')).toBeInViewport();
    // 2 branches of 5 people for 12 months: (50 + 10) × 2 × 10 months' price.
    await page.selectOption('[data-calc="branches"]', '2');
    await page.selectOption('[data-calc="people"]', '5');
    await page.selectOption('[data-calc="months"]', '12');
    await expect(page.locator('[data-calc-total]')).toHaveText('Total: AED\u00a01,200');
    await page.locator('details[data-faq="price"] summary').click();
    await expect(page.locator('details[data-faq="price"] .uae')).toContainText('AED\u00a050 a month per branch, for up to 4 people');
    // Four salon types to choose from (brief 5.4).
    await expect(page.locator('a[data-type]')).toHaveCount(4);
    // Start free → the salon types → the sign-up, with the type and the language kept for the app.
    await page.locator('[data-start="hero"]').click();
    await page.locator('a[data-type="ladies"]').click();
    await expect(page.locator('#app')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/sign-up');
    expect(await page.evaluate(() => [localStorage.getItem('device.salonType'), localStorage.getItem('settings.language')])).toEqual(['ladies', 'en']);
    expect(errors).toEqual([]);
  });

  test('a phone set to Arabic opens /ar; someone who chose English stays on "/"', async ({ browser }) => {
    const arabic = await browser.newContext({ locale: 'ar', viewport: { width: 390, height: 844 } });
    const page = await arabic.newPage();
    await page.goto(`${site}/`);
    await expect(page).toHaveURL(`${site}/ar`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    // On a phone the languages are in the header's menu.
    await page.locator('details.menu summary').click();
    await page.locator('details.menu a[data-lang="en"]').click();
    await expect(page).toHaveURL(`${site}/`);
    await expect(page.locator('h1 .uae')).toHaveText('Your salon, balanced to the last dirham.');
    await expect(page.locator('h1 .intl')).toBeHidden();
    await arabic.close();
  });

  test('signed in on this device, or back from a sign-in link: the app', async ({ page }) => {
    await page.goto(`${site}/#access_token=abc&type=signup`);
    await expect(page.locator('#app')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/auth-callback');
    expect(new URL(page.url()).hash).toBe('#access_token=abc&type=signup');
    await page.evaluate(() => localStorage.setItem('sb-local-auth-token', '{}'));
    await page.goto(`${site}/`);
    await expect(page.locator('#app')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

test.describe('on a computer outside the UAE', () => {
  test.use({ viewport: { width: 1366, height: 720 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });

  test('dollars and the "cent" headline; AED | USD in the footer switches and is remembered', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${site}/fr`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByTestId('plan-1').locator('.plan-price .intl')).toBeVisible();
    await expect(page.getByTestId('plan-1').locator('.plan-price .uae')).toBeHidden();
    await expect(page.locator('h1 .intl')).toBeVisible();
    await expect(page.locator('.smalls .small').nth(1).locator('.intl')).toBeVisible();
    await expect(page.locator('footer .areas')).toBeHidden();
    await page.locator('[data-currency="AED"]').click();
    await expect(page.getByTestId('plan-1').locator('.plan-price .uae')).toBeVisible();
    await expect(page.locator('h1 .uae')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-currency="AED"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('plan-1').locator('.plan-price .uae')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    expect(errors).toEqual([]);
  });
});

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('fits the screen in Hindi', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${site}/hi`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    expect(errors).toEqual([]);
  });
});
