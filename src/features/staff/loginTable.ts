/**
 * The brief's B2 table, "What each login can do", as data: one row per thing a salon does, with each login type's
 * answer. A mark (yes, no, view, own, pin) or a phrase from `logins.cell.*`. The database rules (role_capabilities)
 * enforce it; this is what people read (More → Staff → What each login can do).
 */
import type { Role } from '@/lib/permissions';

export type Mark = 'yes' | 'no' | 'view' | 'own' | 'pin';
type Cell = Mark | `cell:${string}`;
export const LOGIN_TYPES: Role[] = ['owner', 'manager', 'cashier', 'staff', 'accountant'];

export interface LoginRow {
  key: string;
  cells: [owner: Cell, manager: Cell, cashier: Cell, staff: Cell, accountant: Cell];
}

export const LOGIN_TABLE: { area: string; rows: LoginRow[] }[] = [
  {
    area: 'bookings',
    rows: [
      { key: 'calendar', cells: ['yes', 'yes', 'yes', 'cell:ownBusy', 'no'] },
      { key: 'addBookings', cells: ['yes', 'yes', 'yes', 'cell:ownAddMove', 'no'] },
      { key: 'noShowDeposit', cells: ['yes', 'yes', 'yes', 'no', 'no'] },
    ],
  },
  {
    area: 'sales',
    rows: [
      { key: 'checkout', cells: ['yes', 'yes', 'yes', 'cell:ifStylistsPay', 'no'] },
      { key: 'discount', cells: ['cell:any', 'cell:anyReason', 'cell:upToLimitPin', 'cell:upToLimitPin', 'no'] },
      { key: 'changePrice', cells: ['yes', 'cell:withReason', 'pin', 'no', 'no'] },
      { key: 'refund', cells: ['yes', 'cell:refundManager', 'pin', 'no', 'no'] },
      { key: 'refundDeposit', cells: ['yes', 'yes', 'pin', 'no', 'no'] },
      { key: 'receipts', cells: ['yes', 'yes', 'yes', 'own', 'no'] },
    ],
  },
  {
    area: 'cash',
    rows: [
      { key: 'countDrawer', cells: ['yes', 'yes', 'cell:blindCount', 'no', 'no'] },
      { key: 'seeExpected', cells: ['yes', 'yes', 'cell:afterCount', 'no', 'cell:viewAfterClose'] },
      { key: 'approveClose', cells: ['yes', 'cell:notOwnCount', 'no', 'no', 'view'] },
      { key: 'pettyCash', cells: ['yes', 'yes', 'cell:pettyLimit', 'no', 'no'] },
      { key: 'cashOut', cells: ['yes', 'yes', 'no', 'no', 'cell:recordDeposit'] },
    ],
  },
  {
    area: 'customers',
    rows: [
      { key: 'customerList', cells: ['yes', 'yes', 'yes', 'cell:ownClients', 'no'] },
      { key: 'contacts', cells: ['yes', 'yes', 'yes', 'cell:hiddenPhones', 'no'] },
      { key: 'editCustomers', cells: ['yes', 'yes', 'yes', 'cell:ownNotes', 'no'] },
      { key: 'merge', cells: ['yes', 'yes', 'no', 'no', 'no'] },
      { key: 'exportDelete', cells: ['yes', 'no', 'no', 'no', 'no'] },
    ],
  },
  {
    area: 'team',
    rows: [
      { key: 'clock', cells: ['cell:anyone', 'cell:anyoneFix', 'cell:selfOthersPin', 'cell:self', 'no'] },
      { key: 'rosters', cells: ['yes', 'yes', 'view', 'own', 'view'] },
      { key: 'staffSetup', cells: ['yes', 'no', 'no', 'no', 'no'] },
      { key: 'resetLogin', cells: ['cell:anyone', 'cell:branchFloor', 'no', 'no', 'no'] },
      { key: 'staffSales', cells: ['yes', 'cell:noSalaries', 'no', 'own', 'yes'] },
      { key: 'salaries', cells: ['yes', 'no', 'no', 'cell:ownPayslips', 'cell:recordOwnerApproves'] },
      { key: 'payroll', cells: ['cell:yesYesYes', 'no', 'no', 'no', 'cell:yesNoYes'] },
    ],
  },
  {
    area: 'stock',
    rows: [
      { key: 'seeStock', cells: ['yes', 'yes', 'yes', 'view', 'yes'] },
      { key: 'countStock', cells: ['yes', 'yes', 'no', 'no', 'view'] },
      { key: 'receive', cells: ['yes', 'yes', 'cell:receiveDelivery', 'no', 'view'] },
      { key: 'bills', cells: ['cell:yesYes', 'cell:yesNo', 'no', 'no', 'cell:yesYes'] },
      { key: 'expenses', cells: ['yes', 'yes', 'no', 'no', 'yes'] },
    ],
  },
  {
    area: 'reports',
    rows: [
      { key: 'home', cells: ['cell:wholeSalon', 'cell:theirBranch', 'cell:today', 'cell:ownDay', 'cell:moneySummary'] },
      { key: 'reportsRow', cells: ['cell:all', 'cell:managerReports', 'no', 'own', 'cell:all'] },
      { key: 'accounts', cells: ['yes', 'no', 'no', 'no', 'yes'] },
      { key: 'closeMonth', cells: ['cell:yesYes', 'no', 'no', 'no', 'cell:yesNo'] },
      { key: 'ledgerExport', cells: ['yes', 'no', 'no', 'no', 'yes'] },
      { key: 'audit', cells: ['yes', 'cell:theirBranch', 'no', 'no', 'yes'] },
    ],
  },
  {
    area: 'setup',
    rows: [
      { key: 'services', cells: ['yes', 'view', 'view', 'view', 'view'] },
      { key: 'branchSettings', cells: ['yes', 'no', 'no', 'no', 'no'] },
      { key: 'compliance', cells: ['yes', 'yes', 'no', 'no', 'view'] },
      { key: 'hygiene', cells: ['yes', 'yes', 'yes', 'yes', 'no'] },
      { key: 'plan', cells: ['yes', 'no', 'no', 'no', 'no'] },
      { key: 'support', cells: ['yes', 'yes', 'yes', 'yes', 'yes'] },
    ],
  },
];

/** A cell's mark, or null for a phrase. */
export function markOf(cell: Cell): Mark | null {
  return cell.startsWith('cell:') ? null : (cell as Mark);
}
