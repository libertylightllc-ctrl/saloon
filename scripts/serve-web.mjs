/**
 * Serves the production web build the way Vercel does with vercel.json (a real file first, then the rewrites in
 * order, with their cookie conditions): the website's home pages, and the app for every other address. For local
 * checks:
 *
 *   npm run build:web:local && node scripts/serve-web.mjs 8090 [dist]
 *
 * /api/* and /_vercel/* answer 404 (the functions and Web Analytics run only on Vercel; the pages work without them).
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const root = process.cwd();
const port = Number(process.argv[2] ?? 8090);
const dist = resolve(root, process.argv[3] ?? 'dist');
const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

function file(path) {
  const full = normalize(join(dist, decodeURIComponent(path)));
  if (!full.startsWith(dist)) return null;
  return existsSync(full) && statSync(full).isFile() ? full : null;
}

/** Vercel's path patterns: "/:name(a|b)" and plain regular expressions. Returns the named values, or null. */
function match(source, path) {
  const names = [];
  const pattern = source.replace(/:(\w+)(\([^)]*\))?/g, (_, name, group) => {
    names.push(name);
    return group ?? '([^/]+)';
  });
  const m = new RegExp(`^${pattern}$`).exec(path);
  return m ? Object.fromEntries(names.map((n, i) => [n, m[i + 1]])) : null;
}

const cookies = (header = '') => Object.fromEntries(header.split(/;\s*/).filter(Boolean).map((c) => c.split('=')));

createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  let target = file(url.pathname);
  if (!target && !/^\/(api|_vercel)\//.test(url.pathname)) {
    const jar = cookies(req.headers.cookie);
    for (const rule of config.rewrites) {
      const values = match(rule.source, url.pathname);
      if (!values) continue;
      const has = (c) => c.type === 'cookie' && c.key in jar;
      if ((rule.missing ?? []).some(has) || !(rule.has ?? []).every(has)) continue;
      target = file(rule.destination.replace(/:(\w+)/g, (_, n) => values[n]));
      break;
    }
  }
  if (!target) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' }).end(readFileSync(target));
}).listen(port, '127.0.0.1', () => console.log(`Serving ${dist} at http://127.0.0.1:${port}`));
