/**
 * Runs before the web build on Vercel. Without a hosted Supabase URL and anon key the site shows
 * "being set up" (never a sign-in that cannot work); this says so clearly in the build log.
 * Reads the same files Expo does for a production build; real environment variables win.
 */
import { existsSync, readFileSync } from 'node:fs';

const files = ['.env.production.local', '.env.local', '.env.production', '.env'];
const fromFiles = {};
for (const file of [...files].reverse()) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) fromFiles[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const get = (key) => process.env[key] ?? fromFiles[key] ?? '';
const url = get('EXPO_PUBLIC_SUPABASE_URL').trim();
const key = get('EXPO_PUBLIC_SUPABASE_ANON_KEY').trim();

const problems = [];
if (!/^https:\/\/\S+$/.test(url)) {
  problems.push(`EXPO_PUBLIC_SUPABASE_URL must be the hosted project URL (https://…supabase.co), not "${url || 'missing'}".`);
}
if (key.length < 20) problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is missing.');

if (problems.length) {
  console.warn(`\nNo hosted database yet — the site will show "being set up" until these are set:\n- ${problems.join('\n- ')}\nSee docs/HOSTED-SUPABASE.md.\n`);
} else {
  console.log(`Web build will use ${url}`);
}
