/**
 * Cuts the Saloqo star from the owner's logo artwork (docs/brand/saloqo-logo.jpg, 2026-10-07) and writes every size
 * the stores, the phone home screens and the installable website need, the in-app brand mark, and the website's
 * manifest (its name comes from src/config/brand.json). Run: node scripts/make-icons.mjs
 *
 * The artwork's ground is one flat navy, so the star is lifted out by turning that navy into transparency; it is then
 * placed on a navy tile (icons) or left on its own (Android's layered icon, the splash).
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const NAVY = '#0B0916';
const NAVY_RGB = [11, 9, 22];
const VIOLET = '#6C45F2';
// The star and its glow in the artwork (896 × 1200): a square above the wordmark.
const CROP = { x: 212, y: 228, side: 471 };

/** star: share of the side the star's square takes; bg: tile colour or 'none'; mono: one white shape (Android 13). */
const OUT = [
  // Store / home-screen icon: a full square (iOS rounds the corners itself and refuses transparency).
  ['assets/images/icon.png', 1024, { star: 0.78, bg: NAVY }],
  // Android layered icon: the star's tips stay inside the 66% safe circle, on a navy layer.
  ['assets/images/android-icon-foreground.png', 512, { star: 0.5, bg: 'none' }],
  ['assets/images/android-icon-background.png', 512, { star: 0, bg: NAVY }],
  ['assets/images/android-icon-monochrome.png', 432, { star: 0.5, bg: 'none', mono: true }],
  // Splash: the star on the navy splash background (app.json).
  ['assets/images/splash-icon.png', 512, { star: 1, bg: 'none' }],
  ['assets/images/favicon.png', 48, { star: 0.86, bg: NAVY, radius: 10 }],
  // In the app: the welcome page and the side navigation (src/ui/BrandMark.tsx rounds the corners).
  ['assets/images/brand-mark.png', 192, { star: 0.86, bg: NAVY }],
  // Installable website.
  ['public/icons/icon-192.png', 192, { star: 0.78, bg: NAVY }],
  ['public/icons/icon-512.png', 512, { star: 0.78, bg: NAVY }],
  ['public/icons/maskable-512.png', 512, { star: 0.66, bg: NAVY }],
  ['public/icons/apple-touch-icon.png', 180, { star: 0.78, bg: NAVY }],
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

// The star alone, the navy ground made transparent (colour to alpha), and the same shape in white.
const artwork = `data:image/jpeg;base64,${readFileSync('docs/brand/saloqo-logo.jpg').toString('base64')}`;
const [star, mono] = await page.evaluate(
  async ({ artwork, crop, navy }) => {
    const img = new Image();
    img.src = artwork;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = crop.side;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, -crop.x, -crop.y);
    const colour = ctx.getImageData(0, 0, crop.side, crop.side);
    const white = ctx.createImageData(crop.side, crop.side);
    const p = colour.data;
    for (let i = 0; i < p.length; i += 4) {
      let a = 0;
      // The star is lighter than the ground everywhere; anything darker is JPEG noise.
      for (let k = 0; k < 3; k++) a = Math.max(a, (p[i + k] - navy[k]) / (255 - navy[k]));
      if (a < 0.012) a = 0;
      for (let k = 0; k < 3; k++) {
        p[i + k] = a ? Math.min(255, Math.max(0, navy[k] + (p[i + k] - navy[k]) / a)) : 0;
        white.data[i + k] = 255;
      }
      p[i + 3] = Math.round(a * 255);
      // One flat shape: the faint glow and the JPEG noise around it would show as grain once tinted.
      white.data[i + 3] = Math.round(Math.min(1, Math.max(0, (a - 0.08) / 0.4)) * 255);
    }
    ctx.putImageData(colour, 0, 0);
    const starUrl = canvas.toDataURL('image/png');
    ctx.putImageData(white, 0, 0);
    return [starUrl, canvas.toDataURL('image/png')];
  },
  { artwork, crop: CROP, navy: NAVY_RGB },
);

for (const [file, size, opts] of OUT) {
  const s = Math.round(size * opts.star);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
      <div id="tile" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
        border-radius:${opts.radius ?? 0}px;background:${opts.bg === 'none' ? 'transparent' : opts.bg}">
        ${s ? `<img src="${opts.mono ? mono : star}" style="width:${s}px;height:${s}px">` : ''}
      </div></body></html>`,
  );
  await page
    .locator('#tile')
    .screenshot({ path: file, omitBackground: opts.bg === 'none' || Boolean(opts.radius) });
  console.log(file);
}
await browser.close();
// iOS refuses an app icon with an alpha channel.
execFileSync('sips', ['-s', 'format', 'jpeg', 'assets/images/icon.png', '--out', '/tmp/icon.jpg'], {
  stdio: 'ignore',
});
execFileSync('sips', ['-s', 'format', 'png', '/tmp/icon.jpg', '--out', 'assets/images/icon.png'], {
  stdio: 'ignore',
});

const brand = JSON.parse(readFileSync('src/config/brand.json', 'utf8'));
const manifest = {
  name: brand.appName,
  short_name: brand.appName,
  description:
    'Queue, sales, cash closing, stock, staff, payroll and UAE VAT for barber shops and ladies salons.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  // The installed website opens on the logo's navy, like the app's splash.
  background_color: NAVY,
  theme_color: VIOLET,
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync('public/manifest.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);
console.log('public/manifest.webmanifest');
