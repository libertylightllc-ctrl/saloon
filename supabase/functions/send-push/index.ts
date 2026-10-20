// Delivers waiting notifications to the phones of the people they are for (Expo push service).
// Called every minute by pg_cron (dispatch_push) and safe to call any time: each notification goes out once.
// PUSH_ENDPOINT overrides the Expo URL on the local stack only (the push-sink stand-in; ../_shared/env.ts).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { cors, json } from '../_shared/staff.ts';
import { localOnly } from '../_shared/env.ts';

const EXPO = 'https://exp.host/--/api/v2/push/send';

interface Pending {
  id: string;
  member_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  /** The phones of the person it is for. */
  tokens: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Take a batch in one step inside the database (marked pushed, with each person's phones): an overlapping run
  // cannot send the same one twice, and no list of ids goes in a URL (past ~200 ids the gateway refused it, 2026-10-20).
  const { data: claimed, error } = await admin.rpc('claim_pending_push', { p_limit: 300 });
  if (error) return json({ error: error.message }, 500);
  const toSend = (claimed ?? []) as Pending[];
  if (toSend.length === 0) return json({ sent: 0 });

  const messages = toSend.flatMap((n) =>
    n.tokens.map((to) => ({
      n,
      message: { to, title: n.title, body: n.body, sound: 'default', data: { id: n.id, type: n.type, entity_type: n.entity_type, entity_id: n.entity_id } },
    })),
  );
  const endpoint = localOnly('PUSH_ENDPOINT') || EXPO;
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
