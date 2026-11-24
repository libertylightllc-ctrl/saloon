// The console's System health (owner's brief, Part B, B10, 24 Nov 2026): Saloqo's emails, Creem's payment notices and
// the day's exchange rates are written down as they happen. Writing it never fails what the function was doing.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.109.0';

export type HealthKind = 'email' | 'card_webhook' | 'rates';

export async function logHealth(admin: SupabaseClient, kind: HealthKind, ok: boolean, detail: string): Promise<void> {
  try {
    await admin.rpc('log_health', { p_kind: kind, p_ok: ok, p_detail: detail.slice(0, 500) });
  } catch {
    // Only a record: the email, payment or rates went their way regardless.
  }
}
