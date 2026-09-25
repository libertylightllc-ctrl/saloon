/**
 * Reads the local stack's keys from `supabase status` so no key is ever written into the repo.
 * Hosted or CI runs can set E2E_SUPABASE_URL / E2E_ANON_KEY / E2E_SERVICE_KEY instead.
 */
import { execSync } from 'child_process';

export default function globalSetup() {
  if (process.env.E2E_ANON_KEY && process.env.E2E_SERVICE_KEY) return;
  const out = execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const status = JSON.parse(out.slice(out.indexOf('{'))) as Record<string, string>;
  process.env.E2E_SUPABASE_URL ??= status.API_URL;
  process.env.E2E_ANON_KEY ??= status.ANON_KEY;
  process.env.E2E_SERVICE_KEY ??= status.SERVICE_ROLE_KEY;
  process.env.E2E_MAILPIT_URL ??= status.MAILPIT_URL ?? status.INBUCKET_URL;
}
