/**
 * Backup & recovery (owner): every table of the salon as a CSV file, all in one ZIP. Read page by page with
 * the owner's own access, so it holds exactly what the owner may see. Staff pay and item costs come from the
 * owner's functions (their columns are closed to plain reads).
 */
import type { CsvCell } from '@/lib/exportFile';
import { supabase } from '@/lib/supabase';

type Row = Record<string, unknown>;

/** Tables with a business_id, read directly. */
const OWN = [
  'branches', 'members', 'customers', 'service_categories', 'services', 'rooms', 'appointments', 'sales', 'refunds',
  'refund_requests', 'expense_categories', 'expenses', 'suppliers', 'purchase_bills', 'supplier_payments',
  'stock_movements', 'stock_counts', 'rosters', 'attendance', 'payroll_runs', 'payroll_lines', 'payroll_adjustments',
  'tip_payouts', 'cash_closings', 'compliance_documents', 'hygiene_logs', 'accounts', 'journal_entries', 'periods',
  'audit_log', 'access_history',
] as const;

/** Tables that belong to a business through a parent row. */
const CHILD: { table: string; parent: string }[] = [
  { table: 'sale_lines', parent: 'sales' },
  { table: 'sale_payments', parent: 'sales' },
  { table: 'appointment_services', parent: 'appointments' },
  { table: 'service_recipe_items', parent: 'services' },
  { table: 'purchase_bill_lines', parent: 'purchase_bills' },
  { table: 'journal_lines', parent: 'journal_entries' },
];

const PAGE = 1000;
/** A stable order for paging; most tables have an id. */
const ORDER: Record<string, string> = { periods: 'month', rosters: 'employee_id', service_recipe_items: 'service_id' };

async function readAll(table: string, businessId: string, parent?: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const query = parent
      ? supabase.from(table as 'sales').select(`*, ${parent}!inner(business_id)`).eq(`${parent}.business_id` as 'business_id', businessId)
      : supabase.from(table as 'sales').select('*').eq('business_id', businessId);
    const { data, error } = await query.order(ORDER[table] ?? 'id').range(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page.map((r) => (parent ? Object.fromEntries(Object.entries(r).filter(([k]) => k !== parent)) : r)));
    if (page.length < PAGE) return rows;
  }
}

async function rpcRows(fn: 'staff_directory' | 'inventory_levels', args: Record<string, string>): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.rpc(fn as 'staff_directory', args as { p_business: string }).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if ((data ?? []).length < PAGE) return rows;
  }
}

/** A table as CSV rows: a header of column names, then values (objects and lists as JSON). */
export function tableCsv(rows: Row[]): CsvCell[][] {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown): CsvCell =>
    v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean).toString();
  return [columns, ...rows.map((r) => columns.map((c) => cell(r[c])))];
}

export async function backupFiles(
  businessId: string,
  branchIds: string[],
  onProgress: (done: number, total: number) => void,
): Promise<Record<string, CsvCell[][]>> {
  const jobs: [string, () => Promise<Row[]>][] = [
    ['businesses', async () => {
      const { data, error } = await supabase.from('businesses').select('*').eq('id', businessId);
      if (error) throw error;
      return data as unknown as Row[];
    }],
    ...OWN.map((table) => [table, () => readAll(table, businessId)] as [string, () => Promise<Row[]>]),
    ...CHILD.map(({ table, parent }) => [table, () => readAll(table, businessId, parent)] as [string, () => Promise<Row[]>]),
    ['employees', () => rpcRows('staff_directory', { p_business: businessId })],
    ...branchIds.map(
      (id, i) => [branchIds.length > 1 ? `inventory_${i + 1}` : 'inventory', () => rpcRows('inventory_levels', { p_branch: id })] as [string, () => Promise<Row[]>],
    ),
  ];
  const files: Record<string, CsvCell[][]> = {};
  let done = 0;
  for (const [name, read] of jobs) {
    files[name] = tableCsv(await read());
    onProgress(++done, jobs.length);
  }
  return files;
}
