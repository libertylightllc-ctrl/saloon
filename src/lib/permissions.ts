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
  noShowOrCancel: ['owner', 'cashier'],
  manageUsers: ['owner'],
  manageBranch: ['owner'],
  viewActivity: ['owner', 'accountant'],
  viewAccounting: ['owner', 'accountant'],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof MATRIX;

export function can(role: Role | null | undefined, capability: Capability, rules?: BranchRules): boolean {
  if (!role) return false;
  if (capability === 'sell' && role === 'staff') return Boolean(rules?.staffCanSell);
  return (MATRIX[capability] as readonly Role[]).includes(role);
}

export type TabKey = 'index' | 'queue' | 'sale' | 'customers' | 'more';

export function tabsFor(role: Role, rules: BranchRules): TabKey[] {
  const tabs: TabKey[] = ['index'];
  if (can(role, 'addToQueue')) tabs.push('queue');
  if (can(role, 'sell', rules)) tabs.push('sale');
  if (can(role, 'viewCustomers') && role !== 'accountant') tabs.push('customers');
  tabs.push('more');
  return tabs;
}
