/**
 * Who may do what: the owner's B2 table (owner's app check, 9 Nov 2026; docs/PART-B-PLAN.md). The database holds the
 * same list (role_capabilities, migration 87) and enforces it; this decides what the app shows. A test
 * (permissions.test.ts) checks that the two lists match.
 *
 * Login types: owner, manager, cashier (shown as "Front desk"), staff (shown as "Stylist / therapist"), accountant.
 * Levels: yes · own (only their own) · pin (a manager's or the owner's PIN on the spot) · limit (up to the branch's
 * limit, then a PIN) · reason (with a reason, which is saved) · branch (only their branches). No entry = not allowed.
 */
export type Role = 'owner' | 'manager' | 'cashier' | 'staff' | 'accountant';
export type Level = 'yes' | 'own' | 'pin' | 'limit' | 'reason' | 'branch';

/** The owner's controls that change what a stylist may do (Branch settings → Controls). */
export interface BranchRules {
  staffCanSell: boolean;
  staffBookSelf?: boolean;
  staffSeePhones?: boolean;
}

export const MATRIX = {
  // Bookings and queue
  viewQueue: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'own' },
  addToQueue: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'own' },
  book: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'own' },
  noShowOrCancel: { owner: 'yes', manager: 'yes', cashier: 'yes' },
  // Sales
  sell: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'own' },
  discount: { owner: 'yes', manager: 'reason', cashier: 'limit', staff: 'limit' },
  changePrice: { owner: 'yes', manager: 'reason', cashier: 'pin' },
  refund: { owner: 'yes', manager: 'reason', cashier: 'pin' },
  refundDeposit: { owner: 'yes', manager: 'yes', cashier: 'pin' },
  receipts: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'own' },
  viewSales: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'own', accountant: 'yes' },
  viewMoney: { owner: 'yes', manager: 'yes', cashier: 'yes', accountant: 'yes' },
  // Cash drawer
  countCash: { owner: 'yes', manager: 'yes', cashier: 'yes' },
  viewClosing: { owner: 'yes', manager: 'yes', cashier: 'yes', accountant: 'yes' },
  approveClosing: { owner: 'yes', manager: 'yes' },
  pettyCash: { owner: 'yes', manager: 'yes', cashier: 'limit' },
  cashOut: { owner: 'yes', manager: 'yes' },
  bankDeposit: { owner: 'yes', manager: 'yes', accountant: 'yes' },
  payTips: { owner: 'yes', manager: 'yes', cashier: 'yes' },
  // Customers
  viewCustomers: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'own' },
  customerContacts: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'own' },
  manageCustomers: { owner: 'yes', manager: 'yes', cashier: 'yes' },
  serviceNotes: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'own' },
  mergeCustomers: { owner: 'yes', manager: 'yes' },
  exportCustomers: { owner: 'yes' },
  deleteCustomers: { owner: 'yes' },
  // Team
  recordAttendance: { owner: 'yes', manager: 'yes', cashier: 'pin' },
  fixAttendance: { owner: 'yes', manager: 'reason' },
  viewAttendance: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'own', accountant: 'yes' },
  manageRoster: { owner: 'yes', manager: 'yes' },
  viewRoster: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'own', accountant: 'yes' },
  viewStaff: { owner: 'yes', manager: 'yes', accountant: 'yes' },
  manageStaff: { owner: 'yes' },
  manageUsers: { owner: 'yes' },
  resetLogin: { owner: 'yes', manager: 'branch' },
  viewStaffSales: { owner: 'yes', manager: 'yes', staff: 'own', accountant: 'yes' },
  viewPayroll: { owner: 'yes', accountant: 'yes' },
  recordPay: { owner: 'yes', accountant: 'yes' },
  runPayroll: { owner: 'yes', accountant: 'yes' },
  approvePayroll: { owner: 'yes' },
  payPayroll: { owner: 'yes', accountant: 'yes' },
  myPay: { staff: 'own' },
  // Stock and suppliers
  viewInventory: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'yes', accountant: 'yes' },
  countStock: { owner: 'yes', manager: 'yes' },
  manageInventory: { owner: 'yes' },
  orderStock: { owner: 'yes', manager: 'yes' },
  receiveDelivery: { owner: 'yes', manager: 'yes', cashier: 'yes' },
  priceDelivery: { owner: 'yes', manager: 'yes', accountant: 'yes' },
  addPurchase: { owner: 'yes', manager: 'yes', accountant: 'yes' },
  viewPurchases: { owner: 'yes', manager: 'yes', accountant: 'yes' },
  payBill: { owner: 'yes', accountant: 'yes' },
  addExpense: { owner: 'yes', manager: 'yes', accountant: 'yes' },
  viewExpenses: { owner: 'yes', manager: 'yes', cashier: 'own', accountant: 'yes' },
  payOrReverseMoneyOut: { owner: 'yes' },
  // Reports and books
  viewReports: { owner: 'yes', manager: 'branch', staff: 'own', accountant: 'yes' },
  viewAccounting: { owner: 'yes', accountant: 'yes' },
  closePeriod: { owner: 'yes', accountant: 'yes' },
  reopenPeriod: { owner: 'yes' },
  exportLedger: { owner: 'yes', accountant: 'yes' },
  viewActivity: { owner: 'yes', manager: 'branch', accountant: 'yes' },
  viewApprovals: { owner: 'yes', manager: 'branch' },
  // Setup
  viewServices: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'yes', accountant: 'yes' },
  manageServices: { owner: 'yes' },
  manageBranch: { owner: 'yes' },
  manageControls: { owner: 'yes' },
  viewCompliance: { owner: 'yes', manager: 'yes', accountant: 'yes' },
  manageCompliance: { owner: 'yes', manager: 'yes' },
  signHygiene: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'yes' },
  backup: { owner: 'yes' },
  viewPlan: { owner: 'yes', accountant: 'yes' },
  requestPlan: { owner: 'yes' },
  support: { owner: 'yes', manager: 'yes', cashier: 'yes', staff: 'yes', accountant: 'yes' },
} as const satisfies Record<string, Partial<Record<Role, Level>>>;

export type Capability = keyof typeof MATRIX;

/** The login type's level for a capability, or null when it is not allowed. */
export function levelOf(role: Role | null | undefined, capability: Capability): Level | null {
  if (!role) return null;
  return (MATRIX[capability] as Partial<Record<Role, Level>>)[role] ?? null;
}

/** Whether to offer the action at all (a PIN or limit level still offers it, then asks for approval). */
export function can(role: Role | null | undefined, capability: Capability, rules?: BranchRules): boolean {
  if (!levelOf(role, capability)) return false;
  if (role === 'staff') {
    // A stylist sells, and sees their own sales to send a receipt again, only when the owner allows it.
    if (capability === 'sell' || capability === 'viewSales' || capability === 'receipts') return Boolean(rules?.staffCanSell);
    if (capability === 'book') return rules?.staffBookSelf !== false;
    if (capability === 'customerContacts') return Boolean(rules?.staffSeePhones);
  }
  return true;
}

export type TabKey = 'index' | 'queue' | 'sale' | 'customers' | 'pay' | 'reports-tab' | 'accounts-tab' | 'more';

/** The bottom tabs per login type (brief B8). */
export function tabsFor(role: Role, rules: BranchRules): TabKey[] {
  switch (role) {
    case 'owner':
    case 'cashier':
      return ['index', 'queue', 'sale', 'customers', 'more'];
    case 'manager':
      return ['index', 'queue', 'sale', 'customers', 'reports-tab', 'more'];
    case 'staff':
      return can(role, 'sell', rules) ? ['index', 'queue', 'sale', 'pay', 'more'] : ['index', 'queue', 'pay', 'more'];
    case 'accountant':
      return ['index', 'reports-tab', 'accounts-tab', 'more'];
  }
}
