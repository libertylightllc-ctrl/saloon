import { can, tabsFor } from './permissions';

const off = { staffCanSell: false };
const on = { staffCanSell: true };

describe('tabsFor', () => {
  it('gives owner and cashier the five tabs', () => {
    expect(tabsFor('owner', off)).toEqual(['index', 'queue', 'sale', 'customers', 'more']);
    expect(tabsFor('cashier', off)).toEqual(['index', 'queue', 'sale', 'customers', 'more']);
  });

  it('gives staff Sale only when the branch allows it', () => {
    expect(tabsFor('staff', off)).toEqual(['index', 'queue', 'pay', 'more']);
    expect(tabsFor('staff', on)).toEqual(['index', 'queue', 'sale', 'pay', 'more']);
  });

  it('gives the accountant Home, Reports, Accounting and More', () => {
    expect(tabsFor('accountant', off)).toEqual(['index', 'reports-tab', 'accounts-tab', 'more']);
  });

  it('lets only the owner close a month or download a backup; the accountant reads reports', () => {
    expect(can('accountant', 'viewReports')).toBe(true);
    expect(can('cashier', 'viewReports')).toBe(false);
    expect(can('accountant', 'closePeriod')).toBe(false);
    expect(can('owner', 'closePeriod')).toBe(true);
    expect(can('accountant', 'backup')).toBe(false);
  });
});

describe('can', () => {
  it('lets cashiers add money out but only the owner pay or reverse it; staff see none of it', () => {
    expect(can('cashier', 'addExpense')).toBe(true);
    expect(can('cashier', 'addPurchase')).toBe(true);
    expect(can('cashier', 'payOrReverseMoneyOut')).toBe(false);
    expect(can('owner', 'payOrReverseMoneyOut')).toBe(true);
    expect(can('accountant', 'viewExpenses')).toBe(true);
    expect(can('accountant', 'addExpense')).toBe(false);
    expect(can('staff', 'viewExpenses')).toBe(false);
    expect(can('staff', 'viewPurchases')).toBe(false);
  });

  it('shows accounts and history to the owner and the accountant only', () => {
    expect(can('owner', 'viewAccounting')).toBe(true);
    expect(can('accountant', 'viewAccounting')).toBe(true);
    expect(can('cashier', 'viewAccounting')).toBe(false);
    expect(can('staff', 'viewAccounting')).toBe(false);
    expect(can('cashier', 'viewActivity')).toBe(false);
  });

  it('lets only the owner refund, manage users and switch the salon type', () => {
    expect(can('owner', 'refund')).toBe(true);
    expect(can('cashier', 'refund')).toBe(false);
    expect(can('cashier', 'manageUsers')).toBe(false);
    expect(can('cashier', 'manageBranch')).toBe(false);
  });

  it('hides money from staff', () => {
    expect(can('staff', 'viewMoney')).toBe(false);
    expect(can('accountant', 'viewMoney')).toBe(true);
    expect(can(null, 'viewMoney')).toBe(false);
  });
});
