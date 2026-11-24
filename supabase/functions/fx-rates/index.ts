// The day's exchange rates for the console's reporting currency (owner's brief, Part B, 24 Nov 2026), from
// ExchangeRate-API's open endpoint (no key; the console credits it). The database wakes this every hour until it has
// the day's rates (dispatch_fx_rates); safe to call any time: it does nothing once the day's rates are saved.
// FX_ENDPOINT overrides the address on the local stack only.
import { createClient } from 'npm:@supabase/supabase-js@2.109.0';

import { localOnly } from '../_shared/env.ts';
import { logHealth } from '../_shared/health.ts';
import { cors, json } from '../_shared/staff.ts';
import { parseRates, type RatesReply } from './parse.ts';

const RATES = 'https://open.er-api.com/v6/latest/USD';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const due = await admin.rpc('fx_rates_due');
  if (due.error) return json({ error: due.error.message }, 500);
  if (!due.data) return json({ skipped: 'up_to_date' });

  // Each try is written to the console's System health (B10).
  const failed = async (detail: string, status: number) => {
    await logHealth(admin, 'rates', false, detail);
    return json({ error: detail }, status);
  };
  let reply: RatesReply;
  try {
    const res = await fetch(localOnly('FX_ENDPOINT') || RATES);
    if (!res.ok) return failed(`The rates service answered ${res.status}`, 502);
    reply = (await res.json()) as RatesReply;
  } catch {
    return failed('The rates service could not be reached', 502);
  }
  const parsed = parseRates(reply);
  if (!parsed) return failed('The rates service sent something that is not a full table', 502);
  const { data, error } = await admin.rpc('save_fx_rates', { p_day: parsed.day, p_rates: parsed.rates });
  if (error) return failed(`Saving the rates failed: ${error.message}`, 500);
  await logHealth(admin, 'rates', true, `Rates of ${parsed.day}`);
  return json({ day: parsed.day, saved: data });
});
