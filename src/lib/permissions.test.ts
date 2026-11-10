import { readFileSync } from 'fs';
import { join } from 'path';

import { can, levelOf, MATRIX, tabsFor } from './permissions';

const off = { staffCanSell: false };
const on = { staffCanSell: true };

describe('the app and the database hold the same list', () => {
  it('matches the rows the database test checks role_capabilities against', () => {
    const sql = readFileSync(join(__dirname, '../../supabase/tests/69_roles_foundation.test.sql'), 'utf8');
    const block = sql.slice(sql.indexOf('-- matrix:start'), sql.indexOf('-- matrix:end'));
    const db = [...block.matchAll(/\('([A-Za-z]+)', '([a-z]+)', '([a-z]+)'\)/g)].map((m) => `${m[1]}/${m[2]}/${m[3]}`);
    const app = Object.entries(MATRIX).flatMap(([cap, roles]) =>
      Object.entries(roles).map(([role, level]) => `${cap}/${role}/${level}`),
    );
    expect(db.length).toBeGreaterThan(150);
    expect([...app].sort()).toEqual([...db].sort());
  });
});

describe('tabsFor (brief B8)', () => {
  it('gives the owner and the front desk the five tabs, the manager Reports too', () => {
    expect(tabsFor('owner', off)).toEqual(['index', 'queue', 'sale', 'customers', 'more']);
    expect(tabsFor('cashier', off)).toEqual(['index', 'queue', 'sale', 'customers', 'more']);
    expect(tabsFor('manager', off)).toEqual(['index', 'queue', 'sale', 'customers', 'reports-tab', 'more']);
  });

  it('gives a stylist Sale only when the branch allows it', () => {
    expect(tabsFor('staff', off)).toEqual(['index', 'queue', 'pay', 'more']);
    expect(tabsFor('staff', on)).toEqual(['index', 'queue', 'sale', 'pay', 'more']);
  });

  it('gives the accountant Home, Reports, Accounting and More', () => {
    expect(tabsFor('accountant', off)).toEqual(['index', 'reports-tab', 'accounts-tab', 'more']);
  });
});

describe('can (brief B2)', () => {
  it('lets the owner and the accountant close a month; only the owner reopens it or downloads a backup', () => {
    expect(can('accountant', 'closePeriod')).toBe(true);
    expect(can('owner', 'closePeriod')).toBe(true);
    expect(can('manager', 'closePeriod')).toBe(false);
    expect(can('accountant', 'reopenPeriod')).toBe(false);
    expect(can('accountant', 'backup')).toBe(false);
  });

  it('keeps supplier bills from the front desk; the accountant records and pays them', () => {
    expect(can('cashier', 'addPurchase')).toBe(false);
    expect(can('cashier', 'viewPurchases')).toBe(false);
    expect(can('cashier', 'receiveDelivery')).toBe(true);
    expect(can('accountant', 'addPurchase')).toBe(true);
    expect(can('accountant', 'payBill')).toBe(true);
    expect(can('manager', 'addPurchase')).toBe(true);
    expect(can('manager', 'payBill')).toBe(false);
    expect(can('staff', 'viewPurchases')).toBe(false);
  });

  it('puts refunds, price changes and big discounts behind a PIN for the front desk, a reason for a manager', () => {
    expect(levelOf('cashier', 'refund')).toBe('pin');
    expect(levelOf('manager', 'refund')).toBe('reason');
    expect(levelOf('owner', 'refund')).toBe('yes');
    expect(levelOf('cashier', 'discount')).toBe('limit');
    expect(levelOf('staff', 'discount')).toBe('limit');
    expect(levelOf('cashier', 'changePrice')).toBe('pin');
    expect(levelOf('staff', 'changePrice')).toBeNull();
    expect(levelOf('cashier', 'pettyCash')).toBe('limit');
    expect(levelOf('cashier', 'recordAttendance')).toBe('pin');
    expect(can('accountant', 'refund')).toBe(false);
    expect(can('accountant', 'sell')).toBe(false);
    expect(can('accountant', 'countCash')).toBe(false);
  });

  it('keeps salaries, payroll, prices, logins and the plan from managers', () => {
    for (const cap of ['viewPayroll', 'runPayroll', 'approvePayroll', 'manageServices', 'manageUsers', 'requestPlan'] as const) {
      expect(can('manager', cap)).toBe(false);
    }
    expect(can('manager', 'approveClosing')).toBe(true);
    expect(can('manager', 'countStock')).toBe(true);
    expect(levelOf('manager', 'viewReports')).toBe('branch');
  });

  it('lets only the owner approve payroll, export or delete customers, and change the controls', () => {
    expect(can('owner', 'approvePayroll')).toBe(true);
    expect(can('accountant', 'approvePayroll')).toBe(false);
    expect(can('accountant', 'runPayroll')).toBe(true);
    expect(can('manager', 'exportCustomers')).toBe(false);
    expect(can('manager', 'mergeCustomers')).toBe(true);
    expect(can('manager', 'manageControls')).toBe(false);
  });

  it('follows the owner controls for stylists', () => {
    expect(can('staff', 'sell', off)).toBe(false);
    expect(can('staff', 'sell', on)).toBe(true);
    expect(can('staff', 'book', off)).toBe(true);
    expect(can('staff', 'book', { staffCanSell: false, staffBookSelf: false })).toBe(false);
    expect(can('staff', 'customerContacts', off)).toBe(false);
    expect(can('staff', 'customerContacts', { staffCanSell: false, staffSeePhones: true })).toBe(true);
  });

  it('hides money from stylists and nothing is allowed without a login type', () => {
    expect(can('staff', 'viewMoney')).toBe(false);
    expect(can('accountant', 'viewMoney')).toBe(true);
    expect(can(null, 'viewMoney')).toBe(false);
  });
});
