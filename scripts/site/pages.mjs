/**
 * The app's pages that search engines read, and "not found" (full update, Phase 5).
 * - /contact, /privacy and /terms: the app's page with that page's own title and description already in the HTML
 *   (the app then shows the page as usual and keeps the title in the visitor's language).
 * - 404.html: what Vercel answers, with a real 404, for any address that is not one of the app's pages (vercel.json
 *   lists them); not listed by search engines. `checkRoutes` stops the build when a screen in app/ is missing from
 *   that list, so a new screen can never answer "not found".
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { esc, LANGUAGES, pathOf } from './text.mjs';

export const STATIC_PAGES = ['contact', 'privacy', 'terms'];

/** The app's page with `title`, `description` and its own address in <head> (replaced where the tag exists). */
export function withMeta(spa, { title, description, url }) {
  const set = (html, pattern, value) => html.replace(pattern, (_, a, b) => `${a}${esc(value)}${b}`);
  let html = spa.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = set(html, /(<meta name="description" content=")[^"]*(")/, description);
  html = set(html, /(<link rel="canonical" href=")[^"]*(")/, url);
  html = set(html, /(<meta property="og:title" content=")[^"]*(")/, title);
  html = set(html, /(<meta property="og:description" content=")[^"]*(")/, description);
  html = set(html, /(<meta property="og:url" content=")[^"]*(")/, url);
  html = set(html, /(<meta name="twitter:title" content=")[^"]*(")/, title);
  return set(html, /(<meta name="twitter:description" content=")[^"]*(")/, description);
}

/** The "not found" page: plain, in English with the other languages' home pages, the site's colours. */
export function notFoundPage(c) {
  const t = c.t;
  const langs = LANGUAGES.map((l) => `<a href="${pathOf(l.code)}" lang="${l.code}">${esc(l.name)}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(t('meta.notFound.title'))}</title>
<link rel="icon" href="/favicon.ico">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#0B0916;color:#fff;font:400 16px/24px system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}main{max-width:420px;display:flex;flex-direction:column;align-items:center;gap:16px}h1{margin:0;font-size:28px;line-height:36px}p{margin:0;color:rgba(255,255,255,.72)}.go{display:inline-flex;align-items:center;min-height:52px;padding:0 24px;border-radius:999px;background:#7FE0D2;color:#0B0916;font-weight:600;text-decoration:none}nav{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 16px}nav a{color:#BDEFE8}:focus-visible{outline:3px solid #7FE0D2;outline-offset:2px}</style>
</head>
<body>
<main>
<img src="/site/img/mark-72.webp" width="56" height="56" alt="${esc(c.brand.appName)}">
<h1>${esc(t('notFound.title'))}</h1>
<p>${esc(t('notFound.body'))}</p>
<a class="go" href="/">${esc(t('notFound.home'))}</a>
<nav aria-label="${esc(t('language.title'))}">${langs}</nav>
</main>
</body>
</html>
`;
}

/** Every screen in app/ as an address with sample values ("customers/[id]" → "customers/x1"). */
export function appRoutes(appDir) {
  const out = [];
  const walk = (dir, parts) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full, /^\(.*\)$/.test(name) ? parts : [...parts, name]);
      } else if (/\.tsx$/.test(name) && !/^[_+]/.test(name)) {
        const base = name.replace(/\.tsx$/, '');
        out.push([...parts, ...(base === 'index' ? [] : [base])].map((p) => p.replace(/^\[.*\]$/, 'x1')).join('/'));
      }
    }
  };
  walk(appDir, []);
  return [...new Set(out)];
}

/** Stops the build when vercel.json's list of app pages misses a screen in app/. */
export function checkRoutes(appDir, vercel) {
  const rule = vercel.rewrites.find((r) => r.destination === '/spa.html' && r.source.startsWith('/:route('));
  if (!rule) throw new Error('vercel.json: no "/:route(…)" rewrite to /spa.html');
  const pattern = new RegExp(`^(?:${rule.source.slice('/:route('.length, -1)})$`);
  const missing = appRoutes(appDir).filter((r) => r && !pattern.test(r));
  if (missing.length) throw new Error(`vercel.json does not list these app pages (they would answer 404): ${missing.join(', ')}`);
}
