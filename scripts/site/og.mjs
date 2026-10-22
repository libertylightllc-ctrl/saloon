/**
 * The link-preview picture (website brief 4.3): 1200 × 630, the headline beside real app screens, in the home page's
 * look. Drawn by Chrome from the site's own fonts and pictures; run again only when the headline or the screens
 * change:
 *
 *   node scripts/site/og.mjs   → public/og-image.jpg
 */
import { chromium } from '@playwright/test';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { translator } from './text.mjs';

const root = process.cwd();
const t = translator(root, 'en');
const file = (p) => pathToFileURL(join(root, p)).href;
const font = (w) => `@font-face{font-family:P;src:url(${file(`assets/site/fonts/poppins-latin-${w}.woff2`)});font-weight:${w}}`;
const shot = (name, w, tilt, style) =>
  `<div style="position:absolute;${style};width:${w}px;height:${Math.round(w * 2.164)}px;padding:${Math.round(w * 0.03)}px;border-radius:${w * 0.16}px;background:#0E0D14;box-shadow:0 40px 80px rgba(0,0,0,.45);transform:rotate(${tilt}deg)"><img src="${file(`assets/images/landing/${name}`)}" style="width:100%;height:100%;object-fit:cover;border-radius:${w * 0.13}px"></div>`;

const html = `<!doctype html><html><head><style>${[300, 500, 600].map(font).join('')}
body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:P;color:#fff;background:#0B0916;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(45% 60% at 78% 55%,#1F3A40,rgba(11,9,22,0)),radial-gradient(35% 45% at 5% 100%,rgba(108,69,242,.25),rgba(11,9,22,0))}
.copy{position:absolute;left:72px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;gap:24px}
.brand{display:flex;align-items:center;gap:14px;font-size:30px;font-weight:600}
.brand img{width:56px;height:56px;border-radius:16px}
h1{margin:0;font-size:68px;line-height:78px;font-weight:300}
p{margin:0;font-size:26px;line-height:38px;color:rgba(255,255,255,.75)}
.pill{align-self:flex-start;padding:12px 24px;border-radius:999px;background:#7FE0D2;color:#0B0916;font-size:22px;font-weight:500}
.chip{position:absolute;right:70px;top:150px;padding:10px 20px;border-radius:999px;background:#BDEFE8;color:#0B0916;font-size:20px;font-weight:500;box-shadow:0 24px 60px rgba(0,0,0,.3)}
</style></head><body><div class="glow"></div>
${shot('gents-queue.webp', 230, 7, 'right:60px;top:70px')}
${shot('ladies-home.webp', 260, -5, 'right:250px;top:110px')}
<div class="chip">✓ ${t('auth.landing.balanced')}</div>
<div class="copy"><div class="brand"><img src="${file('assets/site/mark-72.webp')}">Saloqo</div>
<h1>${t('auth.landing.headline')}</h1><p>${t('auth.landing.leadShort')}</p>
<div class="pill">${t('auth.landing.facts.booking')}</div></div>
</body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// From a file next to the pictures: a page from setContent may not read local files.
const draft = join(root, 'assets', 'site', '.og-draft.html');
writeFileSync(draft, html);
await page.goto(pathToFileURL(draft).href, { waitUntil: 'load' });
rmSync(draft);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(root, 'public', 'og-image.jpg'), type: 'jpeg', quality: 86 });
await browser.close();
console.log(`public/og-image.jpg: ${readFileSync(join(root, 'public', 'og-image.jpg')).length} bytes`);
