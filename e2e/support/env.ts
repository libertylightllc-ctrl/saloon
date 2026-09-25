/** Filled by global-setup.ts from `npx supabase status` (local stack must be running). */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — is the local stack running (npx supabase start)?`);
  return value;
}

export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const ANON_KEY = required('E2E_ANON_KEY');
export const SERVICE_KEY = required('E2E_SERVICE_KEY');
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324';

/** A short unique suffix so parallel runs never collide. */
export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
