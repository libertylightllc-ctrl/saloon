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
  // "How long is it free?" with the days from Console → Settings (owner's fix list round 2, A2): the pilot's for UAE
  // visitors while it has places; search engines get the new salon's days only.
  expect(html).toContain('New salons get 30 days free. <span class="uae" data-pilot-open>Pilot salons get 90 days free. </span>Nothing is charged unless you choose a plan');
  expect(html).toContain('"text":"New salons get 30 days free. Nothing is charged unless you choose a plan, and your data stays: you can view and export it any time."');
  expect(html).not.toContain('under More → Plan &amp; billing');
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

// Owner's fix list round 2, A1: the company is not registered yet, so no page says where Saloqo is made; who it
// serves ("For salons in Dubai, Sharjah…") stays.
test('no page in any language says where Saloqo is made', async ({ request }) => {
  const made = ['Built in Dubai', 'Made in', 'صُنع في', 'दुबई में बना', 'में बनाया गया', 'دبئی میں بنی', 'میں بنایا گیا', 'Hecha en Dubái', 'Hecho en', 'Conçue à Dubaï', 'Conçu à Dubaï', 'Feito em'];
  for (const path of ['/', '/ar', '/hi', '/ur', '/es', '/fr', '/pt']) {
    const html = await (await request.get(`${site}${path}`)).text();
    for (const words of made) expect(html, `${path}: ${words}`).not.toContain(words);
    expect(html, path).toContain(`<p class="t-small center">© ${new Date().getFullYear()} Saloqo</p>`);
  }
  const en = await (await request.get(`${site}/`)).text();
  expect(en).toContain('in 7 languages. For barber shops, salons and spas.');
  expect(en).toContain('For salons in Dubai, Sharjah, Abu Dhabi, Ajman, Ras Al Khaimah, Fujairah, Umm Al Quwain and Al Ain.');
});

test('every page of the app opens; any other address is a real "not found"; contact, privacy and terms have their titles', async ({ request }) => {
  // Every screen in app/ (the build stops if vercel.json misses one), as a visitor without the signed-in cookie.
  const routes: string[] = JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', "import { appRoutes } from './scripts/site/pages.mjs'; console.log(JSON.stringify(appRoutes('app')))"], { encoding: 'utf8' }),
  );
  expect(routes.length).toBeGreaterThan(50);
  for (const route of routes) {
    const res = await request.get(`${site}/${route}`, { maxRedirects: 0 });
    expect.soft(res.status(), route).toBe(route === 'welcome' ? 308 : 200);
  }
  for (const path of ['/nope', '/queue/extra', '/wp-login.php', '/b']) {
    const res = await request.get(`${site}${path}`);
    expect(res.status(), path).toBe(404);
    const html = await res.text();
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('<title>Page not found – Saloqo</title>');
  }
  expect((await request.get(`${site}/queue/`, { maxRedirects: 0 })).headers().location).toMatch(/\/queue$/);
  for (const [path, title] of [['/contact', 'Contact Saloqo'], ['/privacy', 'Privacy policy – Saloqo'], ['/terms', 'Terms of use – Saloqo']]) {
    expect(await (await request.get(`${site}${path}`)).text()).toContain(`<title>${title}</title>`);
  }
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
    // 2 branches of 5 people for 12 months: (50 + 10) × 2 × 10 months' price (branches can be added since Phase 6).
    await page.selectOption('[data-calc="branches"]', '2');
    await page.selectOption('[data-calc="people"]', '5');
    await page.selectOption('[data-calc="months"]', '12');
    await expect(page.locator('[data-calc-total]')).toHaveText('Total: AED\u00a01,200');
    await expect(page.locator('details[data-faq="branches"]')).toHaveCount(1);
    await expect(page.locator('#pricing')).toContainText('Every branch in one owner login');
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

test.describe('the app pictures and the tour', () => {
  test.use({ viewport: { width: 1280, height: 800 }, timezoneId: 'Asia/Dubai' });

  test('only the visitor\'s language and currency download, each picture described; "See how it works" walks through a day', async ({ page }) => {
    const errors = watchErrors(page);
    const sets = new Set<string>();
    page.on('request', (r) => {
      const m = /\/shots\/(\w+)\/(\w+)\//.exec(r.url());
      if (m) sets.add(`${m[1]}/${m[2]}`);
    });
    await page.goto(`${site}/es`);
    await page.locator('#types').scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');
    expect([...sets]).toEqual(['es/aed']);
    // Words for screen readers, in the page's language; the hidden currency's pictures are out of the way.
    await expect(page.locator('img.qcard')).toHaveAttribute('alt', /barbero/);
    expect(await page.locator('.phone img:visible').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).alt.length > 20))).toBe(true);

    // AED | USD: the first screen's pictures follow.
    await page.locator('[data-currency="USD"]').click();
    await expect(page.locator('img.qcard')).toHaveAttribute('src', '/site/img/shots/es/usd/queue-card.webp');

    // The tour: the arrows move through the three steps, Esc closes it and the keyboard is back on the link.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('[data-tour]').click();
    const tour = page.locator('#tour');
    await expect(tour).toBeVisible();
    await expect(tour.locator('.tour-step:visible')).toContainText('Paso 1 de 3');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(tour.locator('.tour-step:visible')).toContainText('Paso 3 de 3');
    await expect(tour.locator('[data-start="tour"]')).toBeFocused();
    await expect(tour.locator('[data-tour-next]')).toBeHidden();
    await page.keyboard.press('ArrowLeft');
    await expect(tour.locator('.tour-step:visible')).toContainText('Paso 2 de 3');
    await page.keyboard.press('Escape');
    await expect(tour).toBeHidden();
    await expect(page.locator('[data-tour]')).toBeFocused();
    expect([...sets].sort()).toEqual(['es/aed', 'es/usd']);
    expect(errors).toEqual([]);
  });
});

test.describe('the pilot, for visitors in the UAE', () => {
  test.use({ viewport: { width: 1280, height: 800 }, timezoneId: 'Asia/Dubai' });

  test('a bar, a menu link and the section with its form; an application is thanked; other visitors see none of it', async ({ page }) => {
    const errors = watchErrors(page);
    // Each run applies from an address of its own (the form allows 3 an hour from one address).
    const address = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
    await page.route('**/rest/v1/rpc/apply_for_pilot', (route) =>
      route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': address } }),
    );
    await page.goto(`${site}/`);
    await expect(page.locator('.pilot-bar a[href="#pilot"]')).toContainText('Pilot open');
    await expect(page.locator('.main-nav a[href="#pilot"]')).toBeVisible();
    const form = page.locator('[data-pilot-form]');
    await form.locator('[name="name"]').fill('Mariam');
    await form.locator('[name="salon_name"]').fill('Al Wasl Ladies');
    await form.locator('[name="area"]').fill('Al Wasl');
    await form.locator('[name="salon_type"]').selectOption('ladies');
    await form.locator('[name="staff_count"]').fill('6');
    await form.locator('[name="whatsapp"]').fill('050 123 4567');
    await form.locator('[name="whatsapp_ok"]').check();
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('[data-pilot-out]')).toHaveText('Thanks! We’ll message you on WhatsApp within 2 working days.');
    // Elsewhere (USD): no pilot anywhere.
    await page.locator('[data-currency="USD"]').click();
    await expect(page.locator('.pilot-bar')).toBeHidden();
    await expect(page.locator('#pilot')).toBeHidden();
    await expect(page.locator('.main-nav a[href="#pilot"]')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('each empty or wrong field of the pilot form says what it needs, under it; nothing is sent until all are right', async ({ page }) => {
    const errors = watchErrors(page);
    let sent = 0;
    await page.route('**/rest/v1/rpc/apply_for_pilot', (route) => {
      sent += 1;
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto(`${site}/`);
    const form = page.locator('[data-pilot-form]');
    const message = (name: string) => form.locator(`[data-error-for="${name}"]`);
    await form.locator('button[type="submit"]').click();
    await expect(message('name')).toHaveText('Enter your name (at least 2 letters).');
    await expect(message('salon_name')).toHaveText('Enter your salon’s name (at least 2 letters).');
    await expect(message('staff_count')).toHaveText('Enter how many staff you have (1 to 500).');
    await expect(message('whatsapp')).toHaveText('Enter a WhatsApp number, for example 050 123 4567.');
    await expect(message('whatsapp_ok')).toHaveText('Tick this so we can message you about the pilot.');
    await expect(form.locator('[name="name"]')).toBeFocused();
    await expect(form.locator('[name="name"]')).toHaveAttribute('aria-invalid', 'true');
    await expect(message('area')).toBeHidden();
    // Fixing a field takes its message away at once; a wrong value still has one.
    await form.locator('[name="name"]').fill('Mariam');
    await expect(message('name')).toBeHidden();
    await form.locator('[name="salon_name"]').fill('  ');
    await form.locator('[name="staff_count"]').fill('600');
    await form.locator('[name="whatsapp"]').fill('12');
    await expect(message('salon_name')).toBeVisible();
    await expect(message('staff_count')).toBeVisible();
    await expect(message('whatsapp')).toBeVisible();
    await form.locator('[name="salon_name"]').fill('Al Wasl Ladies');
    await form.locator('[name="staff_count"]').fill('6');
    await form.locator('[name="whatsapp"]').fill('050 123 4567');
    await form.locator('button[type="submit"]').click();
    // The WhatsApp tick is needed: it is the only way the team can reply.
    await expect(message('whatsapp_ok')).toBeVisible();
    await expect(form.locator('[name="whatsapp_ok"]')).toBeFocused();
    expect(sent).toBe(0);
    await form.locator('[name="whatsapp_ok"]').check();
    await expect(message('whatsapp_ok')).toBeHidden();
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('[data-pilot-out]')).toHaveText('Thanks! We’ll message you on WhatsApp within 2 working days.');
    expect(sent).toBe(1);
    expect(errors).toEqual([]);
  });

  test('"Why salons choose Saloqo" sets Saloqo beside many salon apps, for UAE visitors only', async ({ page }) => {
    await page.goto(`${site}/`);
    const table = page.locator('section.compare table');
    await expect(page.getByRole('heading', { name: 'Why salons choose Saloqo' })).toBeVisible();
    await expect(table.locator('thead th')).toHaveText(['Saloqo', 'Many salon apps']);
    await expect(table.locator('tbody tr')).toHaveCount(7);
    await expect(table.getByRole('row', { name: /Each extra branch/ })).toContainText('AED 50 a month for up to 4 people');
    await expect(table.getByRole('row', { name: /Booking commission/ })).toContainText('None, ever');
    await page.locator('[data-currency="USD"]').click();
    await expect(page.locator('section.compare')).toBeHidden();
  });

  test('in Arabic the places left take the form Arabic uses for that number', async ({ page }) => {
    const cases = [
      [20, 'يتبقى 20 مكانًا'],
      [5, 'يتبقى 5 أماكن'],
      [2, 'يتبقى مكانان'],
      [1, 'يتبقى مكان واحد'],
      [100, 'يتبقى 100 مكان'],
    ] as const;
    for (const [left, text] of cases) {
      await page.route('**/rest/v1/rpc/pilot_status', (route) => route.fulfill({ json: { max: 120, days: 90, places_left: left } }));
      await page.goto(`${site}/ar`);
      await expect(page.locator('.pilot-bar [data-pilot-places]')).toHaveText(text);
      await page.unroute('**/rest/v1/rpc/pilot_status');
    }
  });
});
