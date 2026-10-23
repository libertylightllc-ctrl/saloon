// Emails the platform owner when a salon asks for its plan (owner, 2026-10-04) and when someone writes to Help &
// support (2026-10-12), through Resend from
// no-reply@saloqo.com. Called by the database when a request is made (dispatch_plan_alerts) and every 10 minutes as a
// retry; safe to call any time: each request is told once. Needs the RESEND_API_KEY secret (the owner sets it); without
// it nothing is sent and the requests wait. EMAIL_ENDPOINT overrides Resend on the local stack only (mail-sink).
import { createClient } from 'npm:@supabase/supabase-js@2.109.0';

import { localOnly, secret } from '../_shared/env.ts';
import { cors, json } from '../_shared/staff.ts';

const RESEND = 'https://api.resend.com/emails';
const SITE = 'https://www.saloqo.com';

interface Alert {
  event_id: string;
  salon: string;
  code: string;
  country_code: string;
  owner_name: string | null;
  owner_email: string | null;
  people: number;
  included_people: number;
  base_minor: number;
  extra_person_minor: number;
  monthly_minor: number;
  months: number;
  note: string | null;
  currency: string;
  admin_emails: string[] | null;
}

const DECIMALS: Record<string, number> = { KWD: 3, BHD: 3, OMR: 3, JOD: 3, TND: 3, JPY: 0, VND: 0, CLP: 0 };

function money(minor: number, currency: string): string {
  const d = DECIMALS[currency] ?? 2;
  return `${currency} ${(minor / 10 ** d).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

function message(a: Alert) {
  // Priced by people, per salon: the base covers the first few; each person after that adds the extra.
  const total = a.monthly_minor * a.months;
  const extra = Math.max(a.people - a.included_people, 0);
  const monthly = extra
    ? `${money(a.base_minor, a.currency)} for ${a.included_people} people + ${extra} × ${money(a.extra_person_minor, a.currency)}`
    : `${money(a.base_minor, a.currency)} for up to ${a.included_people} people`;
  const lines = [
    `${a.salon} asked to switch on their plan for ${a.months} month(s).`,
    '',
    `Amount: ${money(total, a.currency)} (${monthly} = ${money(a.monthly_minor, a.currency)} a month × ${a.months} month(s))`,
    `People who sign in: ${a.people}`,
    `Salon code (payment reference): ${a.code}`,
    `Country: ${a.country_code}`,
    `Owner: ${[a.owner_name, a.owner_email].filter(Boolean).join(' · ') || '—'}`,
    ...(a.note ? [`Their note: ${a.note}`] : []),
    '',
    `When the payment arrives, record it: ${SITE}/admin`,
  ];
  return { subject: `Plan request: ${a.salon} · ${a.months} month(s)`, text: lines.join('\n') };
}

interface SupportAlert {
  thread_id: string;
  who: string | null;
  email: string | null;
  salon: string | null;
  salon_code: string | null;
  preview: string | null;
  admin_emails: string[] | null;
}

function supportMessage(a: SupportAlert) {
  const who = a.who || 'Someone';
  const from = a.salon ? `${a.salon} · ${a.salon_code}` : 'not signed in';
  const lines = [
    `${who} (${from}) wrote to Help & support:`,
    '',
    a.preview ?? '',
    '',
    ...(a.email ? [`Their email: ${a.email}`] : []),
    `Answer in the console: ${SITE}/console`,
  ];
  return { subject: `Support: ${who} (${from})`, text: lines.join('\n') };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const key = secret('RESEND_API_KEY');
  // Without a key the requests stay waiting (and are sent once the key is set).
  if (!key) return json({ sent: 0, skipped: 'no_key' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc('claim_plan_alerts');
  if (error) return json({ error: error.message }, 500);
  const alerts = (data ?? []) as Alert[];

  const support = await admin.rpc('claim_support_alerts');
  if (support.error) return json({ error: support.error.message }, 500);
  const supportAlerts = (support.data ?? []) as SupportAlert[];

  const endpoint = localOnly('EMAIL_ENDPOINT') || RESEND;
  const send = (to: string[], subject: string, text: string) =>
    to.length > 0
      ? fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Saloqo <no-reply@saloqo.com>', to, subject, text }),
        })
          .then((r) => r.ok)
          .catch(() => false)
      : Promise.resolve(false);
  let sent = 0;
  for (const a of supportAlerts) {
    const { subject, text } = supportMessage(a);
    if (await send(a.admin_emails ?? [], subject, text)) sent++;
    else {
      console.error(`plan-alert: could not email support thread ${a.thread_id}; it goes back to the queue`);
      await admin.rpc('unclaim_support_alert', { p_thread: a.thread_id });
    }
  }
  for (const a of alerts) {
    const { subject, text } = message(a);
    const ok = await send(a.admin_emails ?? [], subject, text);
    if (ok) sent++;
    else {
      console.error(`plan-alert: could not email ${a.event_id}; it goes back to the queue`);
      await admin.rpc('unclaim_plan_alert', { p_event: a.event_id });
    }
  }
  return json({ sent, waiting: alerts.length + supportAlerts.length - sent });
});
