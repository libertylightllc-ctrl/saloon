// Resets a staff password or disables / re-enables a login. The owner may do this for anyone but themselves; a
// manager only for front-desk and stylist logins in a branch they share (Part B). The database function
// login_admin_for decides, so the rule lives in one place and is covered by the database tests.
import { callerOf, cors, fail, json, MIN_PASSWORD } from '../_shared/staff.ts';

interface Body {
  action: 'reset_password' | 'set_active';
  member_id: string;
  password?: string;
  active?: boolean;
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

  // Look up the target with the service role, then ask the database whether the caller may manage that login.
  const { createClient } = await import('npm:@supabase/supabase-js@2.109.0');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const caller = await callerOf(admin, req);
  if (caller instanceof Response) return caller;
  if (typeof body.member_id !== 'string' || !body.member_id) return fail('not_found', 404);
  const { data: target } = await admin
    .from('members')
    .select('id, user_id, business_id, role, display_name, default_branch_id')
    .eq('id', body.member_id)
    .maybeSingle();
  if (!target) return fail('not_found', 404);
  if (target.role === 'owner') return fail('not_allowed', 403);

  const { data: actorMemberId, error: denied } = await admin.rpc('login_admin_for', {
    p_user: caller.id,
    p_target: target.id,
  });
  if (denied || !actorMemberId) return fail('not_allowed', 403);

  if (body.action === 'reset_password') {
    if ((body.password ?? '').length < MIN_PASSWORD) return fail('weak_password');
    const { error } = await admin.auth.admin.updateUserById(target.user_id, { password: body.password });
    if (error) return fail('update_failed', 500);
  } else if (body.action === 'set_active') {
    const active = Boolean(body.active);
    const { error } = await admin.auth.admin.updateUserById(target.user_id, {
      ban_duration: active ? 'none' : '876000h',
    });
    if (error) return fail('update_failed', 500);
    await admin.from('members').update({ active }).eq('id', target.id);
  } else {
    return fail('invalid_action');
  }

  await admin.from('audit_log').insert({
    business_id: target.business_id,
    branch_id: target.default_branch_id,
    actor_member_id: actorMemberId,
    action: 'update',
    entity_type: 'member',
    entity_id: target.id,
    summary:
      body.action === 'reset_password'
        ? `Reset password for ${target.display_name}`
        : `${body.active ? 'Enabled' : 'Disabled'} login for ${target.display_name}`,
  });
  return json({ ok: true });
});
