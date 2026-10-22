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
  expect(html).toContain('<h1 class="t-hero">Run your salon from your phone</h1>');
  expect(html).toContain('Daily cash closing');
  expect(html).toContain('AED 50.00');
  expect(html).toContain('USD 13.99');
  expect(html).toContain('How much does it cost?');
  expect(html).toContain('"@type":"SoftwareApplication"');
  expect(html).toContain('"@type":"FAQPage"');
  expect(html).toContain('<link rel="canonical" href="https://www.saloqo.com/">');
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  expect(html.match(/rel="alternate" hreflang=/g)).toHaveLength(8);
  // The same page at /welcome; Arabic at /ar, right to left.
  expect(await (await request.get(`${site}/welcome`)).text()).toContain('Run your salon from your phone');
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

  test('the way in stays on screen, questions open, a salon type goes on to the sign-up', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${site}/`);
    await expect(page.locator('h1')).toHaveText('Run your salon from your phone');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await expect(page.getByTestId('landing-price').locator('.uae')).toHaveText('AED 50.00');
    await expect(page.locator('#sticky')).toBeHidden();
    await page.mouse.move(195, 400);
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 200);
    await expect(page.locator('#sticky')).toBeVisible();
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.locator('#sticky')).toBeHidden();
    await page.locator('details[data-faq="price"] summary').click();
    await expect(page.locator('details[data-faq="price"] .uae')).toContainText('AED 50.00 a month for up to 4 people');
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
    await page.locator('details.lang summary').click();
    await page.locator('details.lang a[data-lang="en"]').click();
    await expect(page).toHaveURL(`${site}/`);
    await expect(page.locator('h1')).toHaveText('Run your salon from your phone');
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

  test('the international price, the general lines, no sticky bar', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`${site}/fr`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByTestId('landing-price').locator('.intl')).toBeVisible();
    await expect(page.getByTestId('landing-price').locator('.uae')).toBeHidden();
    await expect(page.locator('.smalls .small').nth(1).locator('.intl')).toBeVisible();
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 300);
    await expect(page.locator('#sticky')).toBeHidden();
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
