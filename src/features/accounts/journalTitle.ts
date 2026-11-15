/**
 * Journal entry titles in the reader's language (owner's app check E8): the server keeps one English note per entry
 * (journal_entries.memo, e.g. "Payroll 2026-10", "Cash close 2026-10-25"); this finds which note it is and shows it as
 * "October 2026 payroll", "Cash close · 25 Oct 2026" in the app's language. Names, categories and suppliers stay as
 * typed; a note no rule knows is shown as written. journalTitle.test.ts checks every note the migrations write.
 */
import type { TFunction } from 'i18next';

type Day = (date: string, pattern: string) => string;
type Value = (m: RegExpExecArray, day: Day) => Record<string, string>;

const FIXED: Record<string, string> = {
  'Opening cash': 'openingCash',
  'Opening stock': 'openingStock',
  'Deposit taken': 'depositTaken',
  'Deposit refunded': 'depositRefunded',
  'Deposit forfeited': 'depositForfeited',
  'Deposit above bill': 'depositAboveBill',
  'Deposit kept — no-show undone': 'depositKeptUndone',
  'Advance reversed': 'advanceReversed',
  'Stock count': 'stockCount',
  'Stock difference': 'stockDifference',
  'Stock used below zero, costed again': 'stockRecost',
};

const month = (v: string, day: Day) => day(`${v}-01`, 'MMMM yyyy');

// First match wins; the more specific come first.
const RULES: [RegExp, string, Value][] = [
  [/^Sale #(\S+)$/, 'sale', (m) => ({ number: m[1]! })],
  [/^Refund sale #(\S+)$/, 'refund', (m) => ({ number: m[1]! })],
  [/^Payroll (\d{4}-\d{2})$/, 'payroll', (m, day) => ({ month: month(m[1]!, day) })],
  [/^Salary (\d{4}-\d{2}) — (.+)$/s, 'salary', (m, day) => ({ month: month(m[1]!, day), name: m[2]! })],
  [/^Cash close (\d{4}-\d{2}-\d{2})$/, 'cashClose', (m, day) => ({ date: day(m[1]!, 'd MMM yyyy') })],
  [/^Reversed expense · (.+)$/s, 'expenseReversed', (m) => ({ category: m[1]! })],
  [/^Expense · (.+)$/s, 'expense', (m) => ({ category: m[1]! })],
  [/^Bill #(\S+) · (.+)$/s, 'bill', (m) => ({ number: m[1]!, supplier: m[2]! })],
  [/^Reversed bill #(\S+)$/, 'billReversed', (m) => ({ number: m[1]! })],
  [/^Reversed (PUR-\d+)$/, 'purchaseReversed', (m) => ({ number: m[1]! })],
  [/^Paid (.+) · bill #(\S+)$/s, 'supplierPaidBill', (m) => ({ supplier: m[1]!, number: m[2]! })],
  [/^Paid (.+)$/s, 'supplierPaid', (m) => ({ supplier: m[1]! })],
  [/^Advance to (.+)$/s, 'advance', (m) => ({ name: m[1]! })],
  [/^Tips paid to (.+)$/s, 'tipsPaid', (m) => ({ name: m[1]! })],
  [/^Stock adjustment: (.+)$/s, 'stockAdjustment', (m) => ({ item: m[1]! })],
];

/** "Cash added · from the bank · <note>": the words translated, the note as typed. */
const CASH_ADDED = /^Cash added · from the (bank|owner)(?: · (.+))?$/s;

/** The title of a journal entry in the app's language; the note as written if no rule knows it. */
export function journalTitle(memo: string, t: TFunction, day: Day): string {
  // Keys come from the rules above, so the typed t() is loosened here.
  const tr = t as unknown as (key: string, values: Record<string, string>) => string;
  const say = (key: string, values: Record<string, string> = {}) => tr(`accounts.memo.${key}`, values);
  const fixed = FIXED[memo];
  if (fixed) return say(fixed);
  const cash = CASH_ADDED.exec(memo);
  if (cash) return [say(cash[1] === 'bank' ? 'cashAddedBank' : 'cashAddedOwner'), cash[2]].filter(Boolean).join(' · ');
  for (const [re, key, values] of RULES) {
    const m = re.exec(memo);
    if (m) return say(key, values(m, day));
  }
  return memo;
}

/** Which rule knows a note (for the test); null if none. */
export function journalRule(memo: string): string | null {
  if (FIXED[memo]) return FIXED[memo]!;
  if (CASH_ADDED.test(memo)) return 'cashAdded';
  return RULES.find(([re]) => re.test(memo))?.[1] ?? null;
}
