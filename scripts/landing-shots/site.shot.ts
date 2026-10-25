/**
 * Every app picture on the website home page and in its tour, in the 7 languages and both currencies (full update,
 * Phase 4), from the demo salons of demo.ts on a 390-wide phone. The screen is captured 47 px shorter than the
 * phone; site-webp.py then adds a status-bar strip in the screen's own top colour, where the frame's camera sits, so
 * the camera never covers a title. Writes e2e-results/site-shots/<cur>/<lang>/<name>.png.
 * Run against a production build (no development tools on screen): npm run build:web:local,
 * node scripts/serve-web.mjs 8300 dist, then
 * E2E_PORT=8300 npx playwright test -c scripts/landing-shots/playwright.config.ts site
 * and python3 scripts/landing-shots/site-webp.py. SHOT_LANGS=en,ar captures only those languages.
 */
import type { Browser, Locator, Page } from '@playwright/test';

import { expect, test } from '../../e2e/support/fixtures';
import { id, signInOwner } from '../../e2e/support/ui';
import { afternoonZone, dateIn, inLang, LANGS, PEOPLE, SERVICES, SETS, type Cur, type Lang } from './demo';
import { localize, makeDay, makeMonth, makeSalon, type Made } from './setup';

const OUT = 'e2e-results/site-shots';
const PHONE = { width: 390, height: 797 };
const langs = (process.env.SHOT_LANGS?.split(',') ?? LANGS) as Lang[];

async function signedIn(browser: Browser, zone: string, made: Made): Promise<Page> {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, locale: 'en-US', timezoneId: zone });
  const page = await ctx.newPage();
  await page.addInitScript((mode) => localStorage.setItem('device.salonType', mode), made.salon.mode);
  await page.goto('/sign-in');
  await signInOwner(page, made.owner.email, made.owner.password);
  return page;
}

/** Opens `path` in `lang` (the app reads its language when it starts). */
async function open(page: Page, lang: Lang, path: string, ready: (p: Page) => Locator) {
  await page.evaluate((l) => localStorage.setItem('settings.language', l), lang);
  await page.goto(path);
  await expect(ready(page)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500); // fonts, pictures and the chart settle
}

const shot = (page: Page | Locator, cur: Cur, lang: Lang, name: string) => page.screenshot({ path: `${OUT}/${cur}/${lang}/${name}.png` });
const row = (page: Page, name: string) => page.locator('[data-testid^="queue-row-"]').filter({ hasText: name }).first();

for (const cur of ['aed', 'usd'] as const) {
  test(`${cur} pictures`, async ({ browser }) => {
    test.setTimeout(60 * 60_000);
    const set = SETS[cur];
    const zone = afternoonZone();
    const today = dateIn(zone);
    const { gents: g, ladies: l, unisex: u, wellness: w } = set.salons;
    const gents = await makeSalon(set, g, zone);
    const ladies = await makeSalon(set, l, zone, set.day.opening);
    await makeDay(ladies, set, dateIn(zone, -1), dateIn(zone, -2));
    const unisex = await makeSalon(set, u, zone);
    const wellness = await makeSalon(set, w, zone);
    // The month's report from a shop of its own: its closed day would get in the way of the sale picture.
    const reports = await makeSalon(set, { ...g, staff: [], visits: [] }, zone, set.day.opening);
    await makeMonth(reports.owner, set, today);

    const pages = {
      gents: await signedIn(browser, zone, gents),
      ladies: await signedIn(browser, zone, ladies),
      unisex: await signedIn(browser, zone, unisex),
      wellness: await signedIn(browser, zone, wellness),
      reports: await signedIn(browser, zone, reports),
    };
    for (const lang of langs) {
      for (const made of [gents, ladies, unisex, wellness, reports]) await localize(made, lang);
      const svc = (name: string) => inLang(SERVICES, name, lang);
      const person = (name: string) => inLang(PEOPLE, name, lang);

      let p = pages.gents;
      const first = person(g.visits[0]!.name!);
      await open(p, lang, '/queue', (x) => row(x, first));
      await shot(p, cur, lang, 'gents-queue');
      await shot(row(p, first), cur, lang, 'queue-card');
      await basket(p, lang);
      await shot(p, cur, lang, 'gents-sale');

      p = pages.reports;
      await open(p, lang, '/reports', (x) => id(x, 'report-kpi-sales-value'));
      await p.waitForTimeout(1500); // the chart draws in
      await shot(p, cur, lang, 'gents-reports');

      p = pages.ladies;
      await open(p, lang, '/', (x) => id(x, 'home-greeting'));
      await shot(p, cur, lang, 'ladies-home');
      await open(p, lang, '/queue', (x) => row(x, person(l.visits[1]!.name!)));
      await shot(p, cur, lang, 'ladies-queue');
      await basket(p, lang);
      await shot(p, cur, lang, 'ladies-sale');
      await open(p, lang, '/cash-closing', (x) => x.getByText(/\d/).first());
      await shot(p, cur, lang, 'ladies-closing');

      for (const [made, name] of [[unisex, 'unisex-queue'], [wellness, 'wellness-queue']] as const) {
        p = made === unisex ? pages.unisex : pages.wellness;
        await open(p, lang, '/queue', (x) => row(x, person(made.salon.visits[0]!.name!)));
        await shot(p, cur, lang, name);
      }

      // The free booking page, as a customer sees it (not signed in), with a haircut picked.
      const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, locale: 'en-US', timezoneId: zone });
      const visitor = await ctx.newPage();
      await visitor.addInitScript((x) => localStorage.setItem('settings.language', x), lang);
      await visitor.goto(`/b/${gents.slug!}`);
      await expect(id(visitor, 'booking-salon')).toBeVisible({ timeout: 30_000 });
      await id(visitor, `booking-service-${svc('Haircut')}`).click();
      await visitor.waitForTimeout(1500);
      await shot(visitor, cur, lang, 'gents-booking');
      await ctx.close();
    }
  });
}

/** Quick sale with the first two services in the basket (the tiles follow each language's alphabet), from the top. */
async function basket(page: Page, lang: Lang) {
  const add = page.locator('[data-testid^="tile-"][data-testid$="-add"]');
  await open(page, lang, '/sale', () => add.first());
  // A tapped tile's Add turns into its stepper, so the next "first" is the next tile.
  await add.first().click();
  await add.first().click();
  await page.evaluate(() => document.querySelectorAll('*').forEach((el) => el.scrollTop > 0 && el.scrollTo({ top: 0 })));
  await page.waitForTimeout(800);
}
