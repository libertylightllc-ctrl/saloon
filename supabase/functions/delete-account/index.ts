// A person deletes their own account (the app stores require it). Their details and sign-in go; the salon's records
// of what they did stay, as UAE law requires records to be kept. An owner deleting their account closes the salon,
// and its staff logins go too. See delete_account_data() in the database.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { callerOf, cors, fail, json } from '../_shared/staff.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('method_not_allowed', 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const caller = await callerOf(admin, req);
  if (caller instanceof Response) return caller;

  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    return fail('invalid_body');
  }
  // The app sends this only after the person has confirmed on screen.
  if (body.confirm !== 'DELETE') return fail('not_confirmed');

  const { data, error } = await admin.rpc('delete_account_data', { p_user: caller.id });
  if (error) return fail('delete_failed', 500);
  const result = data as { business_closed: boolean; staff_users: string[] };

  // A soft delete keeps the user row the salon's records point to, but clears the email, password and details,
  // ends every session and frees the Google account to sign up again later.
  for (const id of [...result.staff_users, caller.id]) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id, true);
    if (deleteError) return fail('delete_failed', 500);
  }
  return json({ ok: true, business_closed: result.business_closed });
});
