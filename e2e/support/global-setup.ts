/**
 * Reads the local stack's keys from `supabase status` so no key is ever written into the repo.
 * Hosted or CI runs can set E2E_SUPABASE_URL / E2E_ANON_KEY / E2E_SERVICE_KEY instead.
 * Also tells the database where send-push lives, so the every-minute push job can reach it
 * (inside the local Docker network that is http://kong:8000).
 * Locally it also stops the realtime server from restarting its database stream every 10 minutes
 * (scripts/realtime-local-region.sh), which lost live updates sent during the restart.
 */
import { execSync } from 'child_process';

export default async function globalSetup() {
  if (!(process.env.E2E_ANON_KEY && process.env.E2E_SERVICE_KEY)) {
    const out = execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const status = JSON.parse(out.slice(out.indexOf('{'))) as Record<string, string>;
    process.env.E2E_SUPABASE_URL ??= status.API_URL;
    process.env.E2E_ANON_KEY ??= status.ANON_KEY;
    process.env.E2E_SERVICE_KEY ??= status.SERVICE_ROLE_KEY;
    process.env.E2E_MAILPIT_URL ??= status.MAILPIT_URL ?? status.INBUCKET_URL;
  }
  const url = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const local = /127\.0\.0\.1|localhost/.test(url);
  if (local) execSync('sh scripts/realtime-local-region.sh', { stdio: 'inherit' });
  const res = await fetch(`${url}/rest/v1/rpc/configure_push`, {
    method: 'POST',
    headers: {
      apikey: process.env.E2E_SERVICE_KEY!,
      Authorization: `Bearer ${process.env.E2E_SERVICE_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_project_url: local ? 'http://kong:8000' : url, p_anon_key: process.env.E2E_ANON_KEY }),
  });
  if (!res.ok) throw new Error(`configure_push failed: ${res.status} ${await res.text()}`);
}
