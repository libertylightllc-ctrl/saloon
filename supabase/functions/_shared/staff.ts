// Shared helpers for the staff-login Edge Functions (service role, owner-only).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

export function fail(code: string, status = 400): Response {
  return json({ error: code }, status);
}

export const USERNAME = /^[a-z0-9._-]{3,20}$/;

/**
 * Who is calling, from their access token. A token the sign-in server rejects is "not signed in"; a lookup that
 * could not be made (the sign-in server unreachable or failing) is not the caller's fault: it is logged and answered
 * as busy, so the app says "try again" rather than signing anyone out.
 */
export async function callerOf(admin: SupabaseClient, req: Request): Promise<{ id: string } | Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return fail('not_signed_in', 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error) {
    const status = (error as { status?: number }).status ?? 0;
    if (status >= 400 && status < 500) return fail('not_signed_in', 401);
    console.error('user lookup failed', error.name, status, error.message);
    return fail('server_busy', 503);
  }
  if (!data.user) return fail('not_signed_in', 401);
  return { id: data.user.id };
}
export const MIN_PASSWORD = 8;

export function staffEmail(username: string, businessCode: string): string {
  return `${username}@${businessCode}.staff.internal`;
}

export interface OwnerContext {
  admin: SupabaseClient;
  ownerMemberId: string;
}

/** Confirms the caller is an active owner of the business. */
export async function requireOwner(req: Request, businessId: string): Promise<OwnerContext | Response> {
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const caller = await callerOf(admin, req);
  if (caller instanceof Response) return caller;

  const { data: owner } = await admin
    .from('members')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', caller.id)
    .eq('role', 'owner')
    .eq('active', true)
    .maybeSingle();
  if (!owner) return fail('not_allowed', 403);
  return { admin, ownerMemberId: owner.id };
}
