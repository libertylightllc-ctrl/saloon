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

/** A salon outside the UAE, as the setup wizard sends it (default: the UAE). */
export interface Country {
  country_code: string;
  currency: string;
  timezone: string;
  tax_name?: string;
  tax_rate_bps?: number;
  tax_inclusive?: boolean;
  tax_id_label?: string;
}

export const KUWAIT: Country = { country_code: 'KW', currency: 'KWD', timezone: 'Asia/Kuwait', tax_name: 'VAT', tax_rate_bps: 0 };

/** An owner with a set-up business, created the way the setup wizard does it. */
export async function createOwner(
  mode: Mode,
  opts: { vat?: boolean; openingCash?: number; businessName?: string; plan?: boolean; country?: Country } = {},
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
      opening_hours: { days: [0, 1, 2, 3, 4, 5, 6] },
      vat_mode: opts.vat ? 'on' : 'off',
      trn: opts.vat && !opts.country ? '100234567800003' : null,
      opening_cash_minor: opts.openingCash ?? 0,
      ...opts.country,
    },
  });
  if (rpcError) throw rpcError;
  const r = data as { business_id: string; branch_id: string; code: string };
  // Salons need a paid plan to work (docs/06); flows about something else get one, the plan flow does not.
  if (opts.plan !== false) {
    const { error: planError } = await admin.from('subscriptions').upsert({ business_id: r.business_id, paid_until: '2099-12-31' });
    if (planError) throw planError;
  }
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
  if (error) {
    // Name the server's answer (status and error code), not just "non-2xx".
    const response = (error as { context?: Response }).context;
    const body = response ? await response.text().catch(() => '') : '';
    throw new Error(`create-staff-login answered ${response?.status ?? '?'} ${body}`);
  }
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
      const code = `${msg.Text ?? ''} ${msg.HTML ?? ''}`.match(/\b(\d{6,10})\b/)?.[1];
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

export async function refundSale(owner: Owner, saleId: string, amount: number, method = 'cash') {
  const { error } = await owner.client.rpc('refund_sale', {
    p: { sale_id: saleId, amount_minor: amount, method, reason: 'Test refund', idempotency_key: crypto.randomUUID() },
  });
  if (error) throw error;
}

/** The employee row behind a staff login (tips and commission are per employee). */
export async function employeeOf(memberId: string): Promise<string> {
  const { data, error } = await admin.from('employees').select('id').eq('member_id', memberId).single();
  if (error) throw error;
  return data.id as string;
}

/** A custom-priced sale paid in cash and/or card, with an optional tip for `employeeId`. */
export async function sellCustom(
  client: SupabaseClient,
  owner: Owner,
  opts: { cash?: number; card?: number; tip?: number; employeeId?: string },
) {
  const cash = opts.cash ?? 0;
  const card = opts.card ?? 0;
  const tip = opts.tip ?? 0;
  const { data, error } = await client.rpc('create_sale', {
    p: {
      branch_id: owner.branchId,
      client_ref: crypto.randomUUID(),
      employee_id: opts.employeeId,
      lines: [{ kind: 'custom', name: 'Walk-in service', unit_price_minor: cash + card - tip }],
      tip_minor: tip,
      payments: [
        ...(cash ? [{ method: 'cash', amount_minor: cash }] : []),
        ...(card ? [{ method: 'card', amount_minor: card }] : []),
      ],
    },
  });
  if (error) throw error;
  return data as { sale_id: string; number: number; total_minor: number };
}

/** Makes a signed-up user the platform owner (who switches plans on). */
export async function makePlatformAdmin(email: string): Promise<void> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`no user ${email}`);
  const { error: insertError } = await admin.from('platform_admins').upsert({ user_id: user.id });
  if (insertError) throw insertError;
}
