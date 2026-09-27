// Delivers waiting notifications to the phones of the people they are for (Expo push service).
// Called every minute by pg_cron (dispatch_push) and safe to call any time: each notification goes out once.
// PUSH_ENDPOINT overrides the Expo URL (the local stack points it at the push-sink stand-in).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { cors, json } from '../_shared/staff.ts';

const EXPO = 'https://exp.host/--/api/v2/push/send';

interface Pending {
  id: string;
  member_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: pending, error } = await admin
    .from('notifications')
    .select('id, member_id, type, title, body, entity_type, entity_id')
    .is('pushed_at', null)
    .gt('created_at', new Date(Date.now() - 86_400_000).toISOString())
    .order('created_at')
    .limit(300);
  if (error) return json({ error: error.message }, 500);
  const rows = (pending ?? []) as Pending[];
  if (rows.length === 0) return json({ sent: 0 });

  // Claim them first, so an overlapping run cannot send the same one twice.
  const ids = rows.map((r) => r.id);
  const { data: claimed } = await admin.from('notifications').update({ pushed_at: new Date().toISOString() }).in('id', ids).is('pushed_at', null).select('id');
  const mine = new Set((claimed ?? []).map((c: { id: string }) => c.id));
  const toSend = rows.filter((r) => mine.has(r.id));

  const { data: tokens } = await admin
    .from('push_tokens')
    .select('token, member_id')
    .in('member_id', [...new Set(toSend.map((r) => r.member_id))]);
  const byMember = new Map<string, string[]>();
  for (const t of (tokens ?? []) as { token: string; member_id: string }[]) {
    byMember.set(t.member_id, [...(byMember.get(t.member_id) ?? []), t.token]);
  }

  const messages = toSend.flatMap((n) =>
    (byMember.get(n.member_id) ?? []).map((to) => ({
      n,
      message: { to, title: n.title, body: n.body, sound: 'default', data: { id: n.id, type: n.type, entity_type: n.entity_type, entity_id: n.entity_id } },
    })),
  );
  const endpoint = Deno.env.get('PUSH_ENDPOINT') || EXPO;
  let delivered = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    let tickets: { status: string; id?: string; message?: string; details?: { error?: string } }[] = [];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk.map((c) => c.message)),
      });
      tickets = ((await res.json()) as { data?: typeof tickets }).data ?? [];
    } catch (e) {
      tickets = chunk.map(() => ({ status: 'error', message: String(e) }));
    }
    const records = chunk.map((c, j) => {
      const t = tickets[j] ?? { status: 'error', message: 'no ticket' };
      if (t.status === 'ok') delivered += 1;
      return {
        notification_id: c.n.id,
        token: c.message.to,
        status: t.status,
        ticket: t.id ?? null,
        detail: t.details?.error ?? t.message ?? null,
        title: c.message.title,
        body: c.message.body,
      };
    });
    await admin.from('push_deliveries').insert(records);
    // A phone that uninstalled the app: forget its token.
    const gone = records.filter((r) => r.detail === 'DeviceNotRegistered').map((r) => r.token);
    if (gone.length) await admin.from('push_tokens').delete().in('token', gone);
  }
  return json({ notifications: toSend.length, messages: messages.length, delivered });
});
