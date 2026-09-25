/**
 * Test setup through the same RPCs and Edge Functions the app calls, plus a service-role client
 * for assertions the app itself never makes (journal balance, stock rows).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { ANON_KEY, MAILPIT_URL, SERVICE_KEY, SUPABASE_URL, uid } from './env';

// Node 20 has no global WebSocket; supabase-js only needs the constructor to exist.
if (!('WebSocket' in globalThis)) Object.assign(globalThis, { WebSocket: class {} });

export type Mode = 'gents' | 'ladies';

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
export const admin = createClient(SUPABASE_URL, SERVICE_KEY, noSession);

export async function userClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

export interface Owner {
  email: string;
  password: string;
  name: string;
  client: SupabaseClient;
  businessId: string;
  branchId: string;
  code: string;
}

/** An owner with a set-up business, created the way the setup wizard does it. */
export async function createOwner(
  mode: Mode,
  opts: { vat?: boolean; openingCash?: number; businessName?: string } = {},
): Promise<Owner> {
  const id = uid();
  const email = `owner-${id}@e2e.test`;
  const password = 'Owner1234!';
  const name = `Owner ${id.slice(-4)}`;
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error) throw error;
  const client = await userClient(email, password);
  const { data, error: rpcError } = await client.rpc('create_business', {
    p: {
      business_name: opts.businessName ?? `E2E ${mode} ${id}`,
      owner_name: name,
      mode,
      branch_name: `E2E ${mode} branch`,
      address: 'Al Barsha 1, Dubai',
      phone: '+971 50 000 0000',
      opening_hours: { open: '00:00', close: '23:59', days: [0, 1, 2, 3, 4, 5, 6] },
      vat_mode: opts.vat ? 'on' : 'off',
      trn: opts.vat ? '100234567800003' : null,
      opening_cash_minor: opts.openingCash ?? 0,
    },
  });
  if (rpcError) throw rpcError;
  const r = data as { business_id: string; branch_id: string; code: string };
  return { email, password, name, client, businessId: r.business_id, branchId: r.branch_id, code: r.code };
}

export interface StaffLogin {
  username: string;
  password: string;
  name: string;
  memberId: string;
}

export async function createStaff(
  owner: Owner,
  role: 'cashier' | 'staff' | 'accountant',
  opts: { name?: string; commissionBps?: number } = {},
): Promise<StaffLogin> {
  const username = `${role.slice(0, 4)}${uid().slice(-6)}`;
  const password = 'Staff1234!';
  const name = opts.name ?? `${role[0]!.toUpperCase()}${role.slice(1)} ${username.slice(-3)}`;
  const { data, error } = await owner.client.functions.invoke('create-staff-login', {
    body: {
      business_id: owner.businessId,
      branch_id: owner.branchId,
      display_name: name,
      username,
      password,
      role,
      commission_bps: opts.commissionBps ?? (role === 'staff' ? 1000 : 0),
    },
  });
  if (error) throw error;
  return { username, password, name, memberId: (data as { member_id: string }).member_id };
}

export function staffEmail(code: string, username: string): string {
  return `${username}@${code}.staff.internal`;
}

/** Debits and credits over every journal line of a business. */
export async function journalTotals(businessId: string): Promise<{ debit: number; credit: number; entries: number }> {
  const { data, error } = await admin
    .from('journal_lines')
    .select('debit_minor, credit_minor, journal_entries!inner(business_id)')
    .eq('journal_entries.business_id', businessId);
  if (error) throw error;
  const debit = data.reduce((n, l) => n + Number(l.debit_minor), 0);
  const credit = data.reduce((n, l) => n + Number(l.credit_minor), 0);
  const { count } = await admin
    .from('journal_entries')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId);
  return { debit, credit, entries: count ?? 0 };
}

export async function stockQty(branchId: string, businessId: string, itemName: string): Promise<number> {
  const { data, error } = await admin
    .from('stock_levels')
    .select('qty, inventory_items!inner(name, business_id)')
    .eq('branch_id', branchId)
    .eq('inventory_items.business_id', businessId)
    .eq('inventory_items.name', itemName)
    .single();
  if (error) throw error;
  return Number(data.qty);
}

/** The 6-digit recovery code from the newest email to this address in the local mail catcher. */
export async function latestCode(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`);
    const list = (await res.json()) as { messages?: { ID: string }[] };
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as { Text?: string; HTML?: string };
      const code = `${msg.Text ?? ''} ${msg.HTML ?? ''}`.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No recovery email for ${email}`);
}

export interface SaleRow {
  id: string;
  number: number;
  subtotal_minor: number;
  discount_minor: number;
  tip_minor: number;
  vat_minor: number;
  total_minor: number;
  refunded_minor: number;
  status: string;
  vat_mode: 'on' | 'off';
  sale_payments: { method: string; amount_minor: number }[];
}

export async function latestSale(branchId: string): Promise<SaleRow> {
  const { data, error } = await admin
    .from('sales')
    .select('*, sale_payments(method, amount_minor)')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data as SaleRow;
}

/** VAT inside a VAT-inclusive amount at 5%, rounded half away from zero (same as the RPC). */
export function vatInclusive(gross: number): number {
  return Math.sign(gross) * Math.round(Math.abs(gross * 500) / 10_500);
}

export async function appointmentFor(branchId: string, customerName: string) {
  const { data, error } = await admin
    .from('appointments')
    .select('id, status, deposit_minor, deposit_status, customer_id')
    .eq('branch_id', branchId)
    .eq('customer_name', customerName)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data as { id: string; status: string; deposit_minor: number; deposit_status: string; customer_id: string | null };
}

/** The branch's calendar date `days` from today in Dubai, as YYYY-MM-DD. */
export function dubaiDate(days = 0): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(d);
}

/** A paid sale of one service, through the create_sale RPC as `client`. */
export async function sellService(client: SupabaseClient, owner: Owner, serviceName: string, method = 'cash') {
  const { data: svc, error } = await admin
    .from('services')
    .select('id, price_minor')
    .eq('business_id', owner.businessId)
    .eq('name', serviceName)
    .single();
  if (error) throw error;
  const { data, error: saleError } = await client.rpc('create_sale', {
    p: {
      branch_id: owner.branchId,
      client_ref: crypto.randomUUID(),
      lines: [{ kind: 'service', service_id: svc.id, qty: 1 }],
      payments: [{ method, amount_minor: svc.price_minor }],
    },
  });
  if (saleError) throw saleError;
  return data as { sale_id: string; number: number; total_minor: number };
}
