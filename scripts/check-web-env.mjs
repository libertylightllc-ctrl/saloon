/**
 * Runs before the web build on Vercel. The live site must point at a hosted Supabase project:
 * "auto" (the Mac's local database) or a missing key would ship a site nobody can sign in to.
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
  console.error(`\nWeb build stopped — the live site would not be able to sign anyone in:\n- ${problems.join('\n- ')}\nSee docs/HOSTED-SUPABASE.md.\n`);
  process.exit(1);
}
console.log(`Web build will use ${url}`);
