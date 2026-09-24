// Owner resets a staff password or disables / re-enables a login.
import { cors, fail, json, MIN_PASSWORD, requireOwner } from '../_shared/staff.ts';

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

  // Look up the target with the service role, then check the caller owns that business.
  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const lookup = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: target } = await lookup
    .from('members')
    .select('id, user_id, business_id, role, display_name, default_branch_id')
    .eq('id', body.member_id)
    .maybeSingle();
  if (!target) return fail('not_found', 404);
  if (target.role === 'owner') return fail('not_allowed', 403);

  const ctx = await requireOwner(req, target.business_id);
  if (ctx instanceof Response) return ctx;
  const { admin, ownerMemberId } = ctx;

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
    actor_member_id: ownerMemberId,
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
