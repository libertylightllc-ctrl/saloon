/**
 * The website's home page as real HTML (website brief 4.1–4.5), run after `expo export -p web`:
 *
 *   node scripts/site/build.mjs [dist]
 *
 * - the app's page moves to dist/spa.html: vercel.json serves it for every app address, and at "/" to anyone with
 *   the `sq_in` cookie (set by the app when signed in), so signed-in owners still land in the app;
 * - dist/site/<lang>.html: the home page in each language (served at "/", "/ar", "/hi", …), built from the app's own
 *   words and today's prices; its pictures and fonts go to dist/site/;
 * - dist/sitemap.xml and dist/robots.txt.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { renderPage } from './page.mjs';
import { LANGUAGES, pathOf } from './text.mjs';

const root = process.cwd();
const dist = resolve(root, process.argv[2] ?? 'dist');
const read = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));

/** The same settings Expo reads for a production build (as scripts/check-web-env.mjs); real variables win. */
function env(key) {
  const fromFiles = {};
  for (const file of ['.env', '.env.production', '.env.local', '.env.production.local']) {
    if (!existsSync(join(root, file))) continue;
    for (const line of readFileSync(join(root, file), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) fromFiles[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return (process.env[key] ?? fromFiles[key] ?? '').trim();
}

/** Today's plan prices and trial (the columns visitors may read). Without them the page leaves the price out. */
async function prices(url, key) {
  if (!url || !key) return null;
  try {
    const response = await fetch(
      `${url}/rest/v1/platform_settings?select=price_per_branch_minor,currency,intl_price_per_branch_minor,intl_currency,included_people,extra_person_minor,intl_extra_person_minor,trial_days`,
      { headers: { apikey: key }, signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const [row] = await response.json();
    return row ?? null;
  } catch (error) {
    console.warn(`Website: no prices from ${url} (${error.message}); the pages are built without them.`);
    return null;
  }
}

function copyDir(from, to, pick = () => true) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) if (pick(name)) copyFileSync(join(from, name), join(to, name));
}

function sitemap(website) {
  const alternates = LANGUAGES.map((l) => `<xhtml:link rel="alternate" hreflang="${l.code}" href="${website}${pathOf(l.code)}"/>`).join('');
  const home = LANGUAGES.map(
    (l) => `<url><loc>${website}${pathOf(l.code)}</loc>${alternates}<xhtml:link rel="alternate" hreflang="x-default" href="${website}/"/><changefreq>weekly</changefreq><priority>${l.code === 'en' ? '1.0' : '0.9'}</priority></url>`,
  );
  const legal = ['/privacy', '/terms'].map((p) => `<url><loc>${website}${p}</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${[...home, ...legal].join('\n')}\n</urlset>\n`;
}

/** Search engines read the home page in every language, the legal pages and the salons' booking pages; not the app. */
function robots(website) {
  const allow = ['/$', ...LANGUAGES.filter((l) => l.code !== 'en').map((l) => `/${l.code}$`), '/welcome$', '/b/', '/privacy$', '/terms$', '/sign-up$', '/sign-in$', '/contact$', '/site/', '/_expo/', '/assets/', '/og-image.jpg', '/favicon.ico', '/icons/', '/manifest.webmanifest'];
  return `User-agent: *\n${allow.map((p) => `Allow: ${p}`).join('\n')}\nDisallow: /\n\nSitemap: ${website}/sitemap.xml\n`;
}

async function main() {
  const index = join(dist, 'index.html');
  const spa = join(dist, 'spa.html');
  if (existsSync(index)) renameSync(index, spa);
  else if (!existsSync(spa)) throw new Error(`No ${index}: run "expo export -p web" first.`);

  const brand = read('src/config/brand.json');
  const site = { ...read('src/config/site.json'), supportEmail: brand.supportEmail };
  const supabase = { url: env('EXPO_PUBLIC_SUPABASE_URL'), key: env('EXPO_PUBLIC_SUPABASE_ANON_KEY') };
  // "auto" (local development) is the local database next to the page, as src/lib/supabase.ts resolves it.
  const row = await prices(!supabase.url || supabase.url === 'auto' ? 'http://127.0.0.1:54321' : supabase.url.replace(/\/$/, ''), supabase.key);
  const year = new Date().getFullYear();

  mkdirSync(join(dist, 'site'), { recursive: true });
  for (const { code } of LANGUAGES) {
    const html = renderPage({ root, lang: code, row, brand, site, supabase, year });
    writeFileSync(join(dist, 'site', `${code}.html`), html);
    console.log(`Website: ${pathOf(code)} → site/${code}.html (${Math.round(html.length / 1024)} KB)`);
  }
  copyDir(join(root, 'assets', 'site'), join(dist, 'site', 'img'), (n) => n.endsWith('.webp'));
  // The app pictures, one set per language and currency (full update, Phase 4).
  cpSync(join(root, 'assets', 'site', 'shots'), join(dist, 'site', 'img', 'shots'), { recursive: true });
  copyDir(join(root, 'assets', 'site', 'fonts'), join(dist, 'site', 'fonts'));
  writeFileSync(join(dist, 'sitemap.xml'), sitemap(brand.website));
  writeFileSync(join(dist, 'robots.txt'), robots(brand.website));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
