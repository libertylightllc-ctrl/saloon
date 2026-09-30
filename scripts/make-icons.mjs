/**
 * Draws the app icon (white scissors on a violet-to-coral tile: the two salon looks) and writes every size the
 * stores, the phone home screens and the installable website need, and the website's manifest (its name comes
 * from src/config/brand.json). Run: node scripts/make-icons.mjs
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const VIOLET = '#6C45F2';
const CORAL = '#F2777A';
// lucide "scissors" (24 × 24, stroke).
const SCISSORS = `<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/>
  <circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>`;

/** glyph: share of the side the scissors take; bg: tile colour ('grad', 'none' or a colour); fg: glyph colour. */
function svg(size, { glyph, bg, fg = '#FFFFFF', radius = 0 }) {
  const g = size * glyph;
  const offset = (size - g) / 2;
  const fill = bg === 'grad' ? 'url(#g)' : bg;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${VIOLET}"/><stop offset="1" stop-color="${CORAL}"/></linearGradient></defs>
    ${bg === 'none' ? '' : `<rect width="${size}" height="${size}" rx="${radius}" fill="${fill}"/>`}
    <g transform="translate(${offset} ${offset}) scale(${g / 24})" fill="none" stroke="${fg}" stroke-width="1.9"
       stroke-linecap="round" stroke-linejoin="round">${SCISSORS}</g></svg>`;
}

const OUT = [
  // Store / home-screen icon: a full square (iOS rounds the corners itself and refuses transparency).
  ['assets/images/icon.png', 1024, { glyph: 0.5, bg: 'grad' }],
  // Android adaptive icon: the glyph inside the 66% safe circle, on the gradient background.
  ['assets/images/android-icon-foreground.png', 512, { glyph: 0.34, bg: 'none' }],
  ['assets/images/android-icon-background.png', 512, { glyph: 0, bg: 'grad' }],
  ['assets/images/android-icon-monochrome.png', 432, { glyph: 0.34, bg: 'none' }],
  ['assets/images/splash-icon.png', 512, { glyph: 0.62, bg: 'none', fg: VIOLET }],
  ['assets/images/favicon.png', 48, { glyph: 0.6, bg: 'grad', radius: 10 }],
  // Installable website.
  ['public/icons/icon-192.png', 192, { glyph: 0.5, bg: 'grad', radius: 0 }],
  ['public/icons/icon-512.png', 512, { glyph: 0.5, bg: 'grad', radius: 0 }],
  ['public/icons/maskable-512.png', 512, { glyph: 0.4, bg: 'grad' }],
  ['public/icons/apple-touch-icon.png', 180, { glyph: 0.5, bg: 'grad' }],
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const [file, size, opts] of OUT) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg(size, opts)}</body></html>`,
  );
  await page.locator('svg').screenshot({ path: file, omitBackground: opts.bg === 'none' });
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
  background_color: '#FFFFFF',
  theme_color: VIOLET,
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync('public/manifest.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);
console.log('public/manifest.webmanifest');
