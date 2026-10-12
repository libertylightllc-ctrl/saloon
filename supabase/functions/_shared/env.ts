// Settings for the local stand-ins count only on the local stack (2026-10-12: `supabase secrets set`, run in the
// project folder, also uploaded config.toml's local ones to the live project, which pointed phone notifications at an
// address that only exists in development). A live project ignores them even if they are uploaded again.
const LOCAL = (Deno.env.get('SUPABASE_URL') ?? '').startsWith('http://kong:');

/** A stand-in address (…_ENDPOINT, …_BASE_URL): only on the local stack. */
export function localOnly(name: string): string | undefined {
  return LOCAL ? Deno.env.get(name) || undefined : undefined;
}

/** A provider key; a stand-in's placeholder ("local-…") counts only on the local stack. */
export function secret(name: string): string | undefined {
  const value = Deno.env.get(name);
  if (!value || (!LOCAL && value.startsWith('local-'))) return undefined;
  return value;
}
