// Owner removes someone from the staff, or brings an archived person back. Someone with nothing on record is removed
// completely (with their login); anyone with records is archived — hidden, login off, records kept (UAE law).
// See remove_staff() / restore_staff() in the database.
import { cors, fail, json, requireOwner } from '../_shared/staff.ts';

interface Body {
  employee_id: string;
  action: 'remove' | 'restore';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('method_not_allowed', 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail('invalid_body');
  }
  if (body.action !== 'remove' && body.action !== 'restore') return fail('invalid_action');

  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const lookup = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: employee } = await lookup.from('employees').select('id, business_id').eq('id', body.employee_id).maybeSingle();
  if (!employee) return fail('not_found', 404);

  const ctx = await requireOwner(req, employee.business_id);
  if (ctx instanceof Response) return ctx;
  const { admin, ownerMemberId } = ctx;

  const fn = body.action === 'remove' ? 'remove_staff' : 'restore_staff';
  const { data, error } = await admin.rpc(fn, { p_employee: employee.id, p_actor: ownerMemberId });
  if (error) return fail('update_failed', 500);
  const result = data as { mode: 'removed' | 'archived' | 'restored'; user_id: string | null };

  if (result.user_id) {
    // Removed: the login goes too (nothing refers to it any more). Archived: switched off. Restored: switched on.
    const { error: userError } =
      result.mode === 'removed'
        ? await admin.auth.admin.deleteUser(result.user_id)
        : await admin.auth.admin.updateUserById(result.user_id, { ban_duration: result.mode === 'archived' ? '876000h' : 'none' });
    if (userError) return fail('update_failed', 500);
  }
  return json({ mode: result.mode });
});
