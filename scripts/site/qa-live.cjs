// Phase 7 QA (website brief): the live homepage in en/ar/ur at 375 and 1280 px, Asia/Dubai and Europe/London.
// Run: node scripts/site/qa-live.cjs  (needs Google Chrome; writes docs/qa/*.jpg and docs/qa/results.json)
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve('docs/qa'); // run from the project folder
const BASE = 'https://www.saloqo.com';
const LANGS = ['en', 'ar', 'ur'];
const WIDTHS = [375, 1280];
const ZONES = [
  {
    tz: 'Asia/Dubai',
    key: 'dubai',
    want: { cur: 'AED', set: '/aed/', word: { en: 'dirham', ar: 'درهم', ur: 'درہم' }, pilot: true },
  },
  {
    tz: 'Europe/London',
    key: 'london',
    want: { cur: 'USD', set: '/usd/', word: { en: 'cent', ar: 'سنت', ur: 'سینٹ' }, pilot: false },
  },
];

const CLS_SCRIPT = `
  window.__cls = 0;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
`;

const read = () => {
  const visible = (el) =>
    !!el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
  const hero = document.querySelector('.hero img, [data-hero] img, img[fetchpriority="high"]');
  const shots = [...document.querySelectorAll('img')]
    .filter(visible)
    .map((i) => i.currentSrc || i.src || i.dataset.src || '')
    .filter((s) => s.includes('/shots/'));
  const bar = document.querySelector('.pilot-bar');
  return {
    uae: document.documentElement.getAttribute('data-uae'),
    dir: document.documentElement.getAttribute('dir'),
    headline: document.querySelector('#hero-title')?.innerText.trim(),
    price: document.querySelector('.plan-price')?.innerText.trim(),
    perDay: document.querySelector('[data-testid="landing-per-day"]')?.innerText.trim(),
    hero: hero ? hero.currentSrc || hero.src : null,
    shots: shots.length,
    shotsAed: shots.filter((s) => s.includes('/aed/')).length,
    shotsUsd: shots.filter((s) => s.includes('/usd/')).length,
    pilotBar: visible(bar),
    scrollX: document.documentElement.scrollWidth > window.innerWidth,
  };
};

const check = (r, want, lang) => ({
  price: r.price?.includes(want.cur) && r.perDay?.includes(want.cur),
  screenshots:
    r.shots > 0 &&
    (want.cur === 'AED' ? r.shotsUsd === 0 && r.shotsAed > 0 : r.shotsAed === 0 && r.shotsUsd > 0),
  headline: r.headline?.includes(want.word[lang]),
  pilotBar: r.pilotBar === want.pilot,
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const results = [];
  for (const zone of ZONES)
    for (const lang of LANGS)
      for (const width of WIDTHS) {
        const ctx = await browser.newContext({
          timezoneId: zone.tz,
          viewport: { width, height: width < 768 ? 812 : 900 },
          deviceScaleFactor: 1,
        });
        // The test machine is in the UAE, so the IP check would turn London back into a UAE visitor.
        if (zone.key === 'london') await ctx.route('**/api/geo**', (r) => r.abort());
        await ctx.addInitScript(CLS_SCRIPT);
        const page = await ctx.newPage();
        const errors = [];
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text());
        });
        page.on('pageerror', (e) => errors.push(String(e)));
        const url = `${BASE}${lang === 'en' ? '/' : '/' + lang}?qa=${Date.now()}`;
        for (let attempt = 0; ; attempt++) {
          // This Mac's connection sometimes stalls for 5-20 s before it reaches the site; try again rather than record that.
          try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
            break;
          } catch (e) {
            if (attempt === 3) throw e;
          }
        }
        await page.waitForTimeout(1500);
        // The site scrolls smoothly; the walk below must land exactly, or full-page shots catch the header mid-way.
        await page.evaluate(() => {
          document.documentElement.style.scrollBehavior = 'auto';
        });
        // Walk down the page so lazy images and late sections load, then come back up.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 120));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForFunction(() => window.scrollY === 0);
        await page.waitForTimeout(800);
        const before = await page.evaluate(read);
        const cls = await page.evaluate(() => window.__cls);
        const name = `home-${lang}-${width}-${zone.key}`;
        await page.screenshot({
          path: path.join(OUT, `${name}.jpg`),
          fullPage: true,
          type: 'jpeg',
          quality: 70,
        });

        // Footer switch: flip to the other currency and read the page again.
        const other = zone.want.cur === 'AED' ? 'USD' : 'AED';
        await page.locator(`footer [data-currency="${other}"]`).first().click();
        await page.waitForTimeout(700);
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 80));
          }
        });
        const after = await page.evaluate(read);
        const otherWant = ZONES.find((z) => z.want.cur === other).want;
        const switched = check(after, { ...otherWant, pilot: after.pilotBar }, lang);
        await page
          .locator('#pricing, .plans')
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => {});
        await page.screenshot({
          path: path.join(OUT, `${name}-switched-to-${other.toLowerCase()}.jpg`),
          type: 'jpeg',
          quality: 70,
        });

        const ok = check(before, zone.want, lang);
        results.push({
          name,
          url,
          before,
          ok,
          cls: Math.round(cls * 10000) / 10000,
          switchedTo: other,
          after,
          switched,
          errors,
        });
        console.log(
          name,
          JSON.stringify({
            ...ok,
            footerSwitch: Object.values(switched).every(Boolean),
            cls: results.at(-1).cls,
            errors: errors.length,
            rtl: before.dir,
            scrollX: before.scrollX,
          }),
        );
        await ctx.close();
      }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2) + '\n');
})();
