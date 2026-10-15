/**
 * Captures the real app screens the product video shows (marketing/motion/shots/*.png), from the local app with the
 * demo salons of supabase/seed.sql ("Al Barsha Gents", "Jumeirah Ladies Salon & Spa"). Needs the local database
 * (npx supabase start) and the web app on MOTION_APP (default http://localhost:8090).
 * Run: node marketing/motion/capture.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.env.MOTION_APP ?? 'http://localhost:8090';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(OUT, { recursive: true });
// The seed's demo owners (supabase/seed.sql).
const OWNERS = { gents: 'demo-gents@example.com', ladies: 'demo-ladies@example.com' };
const PASSWORD = 'Demo1234!';

const browser = await chromium.launch({ channel: 'chrome' });
const id = (page, testId) => page.locator(`[data-testid="${testId}"]`).filter({ visible: true }).first();

async function phone(mode, locale = 'en-AE') {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    locale,
    timezoneId: 'Asia/Dubai',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(`${APP}/`);
  await id(page, `welcome-${mode}`).click();
  await id(page, 'sign-in-as-owner').click();
  await id(page, 'field-email').fill(OWNERS[mode]);
  await id(page, 'field-password').fill(PASSWORD);
  await id(page, 'sign-in-submit').click();
  await id(page, 'tab-index').waitFor({ timeout: 60_000 });
  return page;
}

async function shot(page, name) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log('saved', name);
}

/** One card of the screen on its own, for the floating cards. */
async function card(page, locator, name) {
  await locator.screenshot({ path: join(OUT, `${name}.png`) });
  console.log('saved', name);
}

for (const mode of ['gents', 'ladies']) {
  const page = await phone(mode);
  await shot(page, `${mode}-home`);
  await id(page, 'tab-queue').click();
  await shot(page, `${mode}-queue`);
  const rows = page.locator('[data-testid^="queue-row-"]').filter({ visible: true });
  for (let i = 0; i < 3; i++) await card(page, rows.nth(i), `${mode}-card-queue-${i + 1}`);
  await id(page, 'tab-sale').click();
  await page.waitForTimeout(1500);
  const tiles = page.locator('[data-testid^="tile-"][data-testid$="-add"]').filter({ visible: true });
  await tiles.nth(0).click();
  await tiles.nth(2).click();
  await shot(page, `${mode}-sale`);
  await id(page, 'checkout').click();
  await shot(page, `${mode}-checkout`);
  for (const [route, name] of [['/cash-closing', 'closing'], ['/payroll', 'payroll'], ['/reports', 'reports']]) {
    await page.goto(`${APP}${route}`);
    // Payroll worked out for the month (in the local demo salon), so the screen shows each person's pay.
    if (name === 'payroll') {
      const work = page.getByText('Work out payroll', { exact: true }).first();
      if (await work.waitFor({ timeout: 10_000 }).then(() => true, () => false)) {
        await work.click();
        await id(page, 'payroll-net').waitFor({ timeout: 30_000 });
      }
    }
    await shot(page, `${mode}-${name}`);
  }
  await page.context().close();
}

// The app in Arabic (right to left), as an Arabic phone opens it.
const ar = await phone('gents', 'ar-AE');
await shot(ar, 'gents-home-ar');
await ar.context().close();
await browser.close();
