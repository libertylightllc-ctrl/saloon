/**
 * Who may do what (01-PRODUCT §2). Mirrors the SQL role checks in the RPCs and RLS policies —
 * the server enforces, this decides what the app shows.
 */
export type Role = 'owner' | 'cashier' | 'staff' | 'accountant';

export interface BranchRules {
  staffCanSell: boolean;
}

const MATRIX = {
  viewMoney: ['owner', 'cashier', 'accountant'],
  sell: ['owner', 'cashier'],
  refund: ['owner'],
  viewSales: ['owner', 'cashier', 'accountant'],
  manageServices: ['owner'],
  viewServices: ['owner', 'cashier', 'staff', 'accountant'],
  viewCustomers: ['owner', 'cashier', 'accountant'],
  manageCustomers: ['owner', 'cashier'],
  addToQueue: ['owner', 'cashier', 'staff'],
  // Staff add walk-ins only; bookings (and their deposits) are for the owner and cashier (01-PRODUCT §2).
  book: ['owner', 'cashier'],
  noShowOrCancel: ['owner', 'cashier'],
  manageUsers: ['owner'],
  manageBranch: ['owner'],
  viewActivity: ['owner', 'accountant'],
  viewAccounting: ['owner', 'accountant'],
  // Money out (01-PRODUCT §2): cashiers add cash expenses and bills; only the owner pays suppliers,
  // reverses, edits suppliers and adds expense categories. The accountant reads everything.
  addExpense: ['owner', 'cashier'],
  viewExpenses: ['owner', 'cashier', 'accountant'],
  addPurchase: ['owner', 'cashier'],
  viewPurchases: ['owner', 'cashier', 'accountant'],
  payOrReverseMoneyOut: ['owner'],
  // Cash closing (01-PRODUCT §2): the cashier counts and submits, the owner counts and approves.
  viewClosing: ['owner', 'cashier', 'accountant'],
  countCash: ['owner', 'cashier'],
  approveClosing: ['owner'],
  payTips: ['owner', 'cashier'],
  // Inventory (01-PRODUCT §2): everyone sees levels; the owner adds items, adjusts and counts.
  viewInventory: ['owner', 'cashier', 'staff', 'accountant'],
  manageInventory: ['owner'],
  countStock: ['owner'],
  // Staff & payroll (01-PRODUCT §2): the owner runs it, the accountant views; attendance is recorded by the
  // owner and cashier, staff clock themselves.
  viewStaff: ['owner', 'accountant'],
  manageStaff: ['owner'],
  viewAttendance: ['owner', 'cashier', 'accountant'],
  recordAttendance: ['owner', 'cashier'],
  viewPayroll: ['owner', 'accountant'],
  runPayroll: ['owner'],
  myPay: ['staff'],
  // Compliance (01-PRODUCT §2): the owner keeps it; a cashier adds hygiene log entries.
  viewCompliance: ['owner', 'cashier'],
  manageCompliance: ['owner'],
  signHygiene: ['owner', 'cashier'],
  // Books & reports (01-PRODUCT §2): owner full, accountant reads and exports; only the owner closes a month.
  viewReports: ['owner', 'accountant'],
  closePeriod: ['owner'],
  backup: ['owner'],
  // Paid plan (docs/06): the owner asks for it; the accountant can see it.
  viewPlan: ['owner', 'accountant'],
  requestPlan: ['owner'],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof MATRIX;

export function can(role: Role | null | undefined, capability: Capability, rules?: BranchRules): boolean {
  if (!role) return false;
  if (capability === 'sell' && role === 'staff') return Boolean(rules?.staffCanSell);
  return (MATRIX[capability] as readonly Role[]).includes(role);
}

export type TabKey = 'index' | 'queue' | 'sale' | 'customers' | 'pay' | 'reports-tab' | 'accounts-tab' | 'more';

export function tabsFor(role: Role, rules: BranchRules): TabKey[] {
  const tabs: TabKey[] = ['index'];
  if (can(role, 'addToQueue')) tabs.push('queue');
  if (can(role, 'sell', rules)) tabs.push('sale');
  if (can(role, 'viewCustomers') && role !== 'accountant') tabs.push('customers');
  // Staff get "My pay" (03-SCREENS: Staff → Home, Queue, (Sale), My pay, More).
  if (role === 'staff') tabs.push('pay');
  // Accountant → Home, Reports, Accounting, More.
  if (role === 'accountant') tabs.push('reports-tab', 'accounts-tab');
  tabs.push('more');
  return tabs;
}
