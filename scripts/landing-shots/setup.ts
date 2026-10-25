/**
 * Builds the demo salons of demo.ts on the local database through the app's own functions (sales, expenses and
 * advances post their books as in real use), then renames what a salon types for each language.
 */
import { admin, createOwner, sellCustom, type Owner } from '../../e2e/support/api';
import { CATEGORIES, inLang, ITEMS, PEOPLE, ROOMS, SERVICES, type CurrencySet, type Lang, type Salon } from './demo';

export interface Made {
  owner: Owner;
  salon: Salon;
  slug?: string;
  /** Row id → its English name, per table, so each language starts from the English. */
  english: { table: string; column: string; names: typeof SERVICES; rows: Map<string, string> }[];
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

/** The answer's data; throws the error instead (an update without a select answers null, unused). */
async function must<T>(q: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await q;
  if (error) throw error instanceof Error ? error : new Error(JSON.stringify(error));
  return data as NonNullable<T>;
}

async function englishOf(table: string, column: string, filter: [string, string | string[]]): Promise<Map<string, string>> {
  const [key, value] = filter;
  const base = admin.from(table).select(`id, ${column}`);
  const rows = await must(Array.isArray(value) ? base.in(key, value) : base.eq(key, value));
  return new Map((rows as unknown as Record<string, string>[]).filter((r) => r[column]).map((r) => [r.id!, r[column]!]));
}

export async function makeSalon(set: CurrencySet, salon: Salon, zone: string, openingCash = 0): Promise<Made> {
  const owner = await createOwner(salon.mode, { businessName: salon.business, openingCash, country: { ...set.country, timezone: zone } });
  await must(admin.from('branches').update({ name: salon.branch, address: salon.address, phone: salon.phone }).eq('id', owner.branchId));
  await must(admin.from('members').update({ display_name: salon.owner }).eq('business_id', owner.businessId).eq('role', 'owner'));
  for (const [name, price] of Object.entries(salon.prices ?? {})) {
    await must(admin.from('services').update({ price_minor: price }).eq('business_id', owner.businessId).eq('name', name));
  }
  const staff = new Map<string, string>();
  for (const name of salon.staff) {
    const id = await must(owner.client.rpc('save_employee', { p: { business_id: owner.businessId, branch_id: owner.branchId, full_name: name, commission_bps: 1000 } }));
    staff.set(name, id as string);
  }
  const services = new Map((await must(admin.from('services').select('id, name').eq('business_id', owner.businessId))).map((s) => [s.name as string, s.id as string]));
  const rooms = await must(admin.from('rooms').select('id').eq('branch_id', owner.branchId).order('name'));
  for (const v of salon.visits) {
    const at = v.in ? new Date(Date.now() + v.in * 60_000).toISOString() : undefined;
    const id = (await must(
      owner.client.rpc('create_appointment', {
        p: {
          branch_id: owner.branchId, kind: v.in ? 'booking' : 'walk_in', guest_name: v.name ?? null,
          service_ids: v.services.map((s) => services.get(s)!), employee_id: v.staff ? staff.get(v.staff) : null,
          room_id: v.room ? rooms[0]!.id : null, scheduled_at: at,
        },
      }),
    )) as string;
    if (v.started) {
      await must(owner.client.rpc('start_service', { p_id: id }));
      await must(admin.from('appointments').update({ scheduled_at: minutesAgo(v.started + 6), checked_in_at: minutesAgo(v.started + 6), started_at: minutesAgo(v.started) }).eq('id', id));
    } else if (v.wait) {
      await must(admin.from('appointments').update({ scheduled_at: minutesAgo(v.wait), checked_in_at: minutesAgo(v.wait) }).eq('id', id));
    }
  }
  let slug: string | undefined;
  if (salon.mode === 'gents') {
    slug = (await must(owner.client.rpc('set_online_booking', { p_branch: owner.branchId, p_on: true, p_slug: `demo-${owner.code}` }))) as string;
  }
  const appointments = await englishOf('appointments', 'customer_name', ['branch_id', owner.branchId]);
  const visitIds = (await must(admin.from('appointments').select('id').eq('branch_id', owner.branchId))).map((a) => a.id as string);
  return {
    owner, salon, slug,
    english: [
      { table: 'services', column: 'name', names: SERVICES, rows: await englishOf('services', 'name', ['business_id', owner.businessId]) },
      { table: 'service_categories', column: 'name', names: CATEGORIES, rows: await englishOf('service_categories', 'name', ['business_id', owner.businessId]) },
      { table: 'inventory_items', column: 'name', names: ITEMS, rows: await englishOf('inventory_items', 'name', ['business_id', owner.businessId]) },
      { table: 'rooms', column: 'name', names: ROOMS, rows: await englishOf('rooms', 'name', ['branch_id', owner.branchId]) },
      { table: 'employees', column: 'full_name', names: PEOPLE, rows: await englishOf('employees', 'full_name', ['business_id', owner.businessId]) },
      { table: 'members', column: 'display_name', names: PEOPLE, rows: await englishOf('members', 'display_name', ['business_id', owner.businessId]) },
      { table: 'appointments', column: 'customer_name', names: PEOPLE, rows: appointments },
      { table: 'appointment_services', column: 'name_snapshot', names: SERVICES, rows: await englishOf('appointment_services', 'name_snapshot', ['appointment_id', visitIds]) },
    ],
  };
}

/** What a salon would have typed, in `lang`. */
export async function localize(made: Made, lang: Lang): Promise<void> {
  for (const { table, column, names, rows } of made.english) {
    for (const [id, en] of rows) await must(admin.from(table).update({ [column]: inLang(names, en, lang) }).eq('id', id));
  }
}

/** The ladies salon's day so far: two sales (one by card with a tip for the first stylist), yesterday's takings,
 *  tea paid from the till and a cash advance to the third stylist. */
export async function makeDay(made: Made, set: CurrencySet, yesterday: string, earlier: string): Promise<void> {
  const { owner } = made;
  // A salon that has been open a while: its opening cash is from before yesterday, not today's.
  await must(admin.from('journal_entries').update({ business_date: earlier }).eq('source_id', owner.branchId));
  const employees = await must(admin.from('employees').select('id, full_name').eq('business_id', owner.businessId).order('created_at'));
  const [first, , third] = employees;
  for (const [i, [name, method]] of set.day.sales.entries()) {
    const svc = await must(admin.from('services').select('id, price_minor').eq('business_id', owner.businessId).eq('name', name).single());
    const tip = method === 'card' ? set.day.tip : 0;
    await must(owner.client.rpc('create_sale', {
      p: {
        branch_id: owner.branchId, client_ref: crypto.randomUUID(), employee_id: i === 1 ? first!.id : undefined,
        lines: [{ kind: 'service', service_id: svc.id, qty: 1 }], tip_minor: tip,
        payments: [{ method, amount_minor: (svc.price_minor as number) + tip }],
      },
    }));
  }
  const before = await sellCustom(owner.client, owner, { cash: set.day.yesterday });
  await must(admin.from('sales').update({ business_date: yesterday }).eq('id', before.sale_id));
  await must(admin.from('journal_entries').update({ business_date: yesterday }).eq('source_id', before.sale_id));
  const tea = await must(admin.from('expense_categories').select('id').eq('business_id', owner.businessId).eq('key', 'tea_food').single());
  await must(owner.client.rpc('record_expense', { p: { branch_id: owner.branchId, category_id: tea.id, amount_minor: set.day.expense, method: 'cash', note: null } }));
  await must(owner.client.rpc('record_adjustment', { p: { employee_id: third!.id, kind: 'advance', amount_minor: set.day.advance, method: 'cash', note: null, client_ref: crypto.randomUUID() } }));
}

/**
 * The barber shop's month for the report: the month's sales spread over the days so far (busier at the weekend),
 * the month's costs, today's cash counted and approved (balanced), and every required paper on file.
 */
export async function makeMonth(owner: Owner, set: CurrencySet, today: string): Promise<void> {
  const days = Number(today.slice(8, 10));
  const month = today.slice(0, 8);
  const weights = Array.from({ length: days }, (_, i) => {
    const dow = new Date(`${month}${String(i + 1).padStart(2, '0')}T12:00:00Z`).getUTCDay();
    return (dow === 5 || dow === 6 ? 1.45 : dow === 0 ? 1.15 : 1) * (1 + i * 0.012);
  });
  const sumW = weights.reduce((a, b) => a + b, 0);
  const { prices } = set.month;
  let left = set.month.sales;
  for (let d = 0; d < days; d += 1) {
    let target = d === days - 1 ? left : Math.round((set.month.sales * weights[d]!) / sumW / 500) * 500;
    left -= target;
    const ids: string[] = [];
    for (let n = 0; target > 0; n += 1) {
      const price = Math.min(prices[(d * 7 + n * 3) % prices.length]!, target);
      ids.push((await sellCustom(owner.client, owner, n % 3 === 0 ? { card: price } : { cash: price })).sale_id);
      target -= price;
    }
    const date = `${month}${String(d + 1).padStart(2, '0')}`;
    if (date !== today) {
      await must(admin.from('sales').update({ business_date: date }).in('id', ids));
      await must(admin.from('journal_entries').update({ business_date: date }).in('source_id', ids));
    }
  }
  for (const [i, [key, amount]] of set.month.costs.entries()) {
    const cat = await must(admin.from('expense_categories').select('id').eq('business_id', owner.businessId).eq('key', key).single());
    const data = await must(owner.client.rpc('record_expense', {
      p: { branch_id: owner.branchId, category_id: cat.id, amount_minor: amount, method: amount > 100_000 ? 'bank' : 'cash', note: null },
    }));
    const expenseId = (data as { expense_id: string }).expense_id;
    const date = `${month}${String(Math.min(1 + i * 2, days)).padStart(2, '0')}`;
    if (date !== today) {
      await must(admin.from('expenses').update({ business_date: date }).eq('id', expenseId));
      await must(admin.from('journal_entries').update({ business_date: date }).eq('source_id', expenseId));
    }
  }
  const preview = (await must(owner.client.rpc('closing_preview', { p_branch: owner.branchId }))) as { expected_cash_minor: number };
  const count = (await must(owner.client.rpc('submit_cash_count', {
    p: { branch_id: owner.branchId, counted_cash_minor: preview.expected_cash_minor, submit: true, drawer_closed_confirmed: true },
  }))) as { id?: string; closing_id?: string };
  const closingId = count.closing_id ?? count.id;
  if (closingId) await must(owner.client.rpc('approve_cash_closing', { p_id: closingId }));
  const slots = (await must(owner.client.rpc('compliance_status', { p_business: owner.businessId }))) as
    { doc_type: string; holder_type: string; branch_id: string | null; employee_id: string | null; status: string }[];
  const missing = (slots ?? []).filter((x) => x.status !== 'valid');
  if (missing.length) {
    const year = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);
    await must(admin.from('compliance_documents').insert(
      missing.map((x, i) => ({
        business_id: owner.businessId, branch_id: x.branch_id, employee_id: x.employee_id, holder_type: x.holder_type, doc_type: x.doc_type,
        number: `D-${1000 + i}`, issued_on: `${month}01`, expires_on: year, reminder_days: 30,
        evidence_path: `${owner.businessId}/compliance/demo-${i}.jpg`, active: true, version: 1,
      })),
    ));
  }
}
