// Owner creates a username + password login for a cashier, staff member or accountant.
// Staff sign in with salon code + username; the internal email is username@code.staff.internal.
import { cors, fail, json, MIN_PASSWORD, requireOwner, staffEmail, USERNAME } from '../_shared/staff.ts';

interface Body {
  business_id: string;
  branch_id: string;
  username: string;
  password: string;
  display_name: string;
  role: 'cashier' | 'staff' | 'accountant';
  commission_bps?: number;
  colour?: string;
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
  const username = (body.username ?? '').trim().toLowerCase();
  const displayName = (body.display_name ?? '').trim();
  if (!USERNAME.test(username)) return fail('invalid_username');
  if ((body.password ?? '').length < MIN_PASSWORD) return fail('weak_password');
  if (!displayName) return fail('name_required');
  if (!['cashier', 'staff', 'accountant'].includes(body.role)) return fail('invalid_role');
  const commission = Number(body.commission_bps ?? 0);
  if (!Number.isInteger(commission) || commission < 0 || commission > 10000) return fail('invalid_commission');

  const ctx = await requireOwner(req, body.business_id);
  if (ctx instanceof Response) return ctx;
  const { admin, ownerMemberId } = ctx;

  const [{ data: business }, { data: branch }, { data: taken }] = await Promise.all([
    admin.from('businesses').select('code').eq('id', body.business_id).single(),
    admin.from('branches').select('id').eq('id', body.branch_id).eq('business_id', body.business_id).maybeSingle(),
    admin.from('members').select('id').eq('business_id', body.business_id).eq('username', username).maybeSingle(),
  ]);
  if (!business || !branch) return fail('not_found', 404);
  if (taken) return fail('username_taken', 409);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: staffEmail(username, business.code),
    password: body.password,
    email_confirm: true,
    user_metadata: { display_name: displayName, username },
  });
  if (createError || !created.user) {
    const exists = /already|exists|registered/i.test(createError?.message ?? '');
    return fail(exists ? 'username_taken' : 'create_failed', exists ? 409 : 500);
  }

  const { data: registered, error: registerError } = await admin.rpc('register_staff_member', {
    p: {
      business_id: body.business_id,
      branch_id: body.branch_id,
      user_id: created.user.id,
      username,
      display_name: displayName,
      role: body.role,
      commission_bps: commission,
      colour: body.colour ?? null,
      actor_member_id: ownerMemberId,
    },
  });
  if (registerError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return fail('create_failed', 500);
  }
  return json({ ...registered, username });
});
