/** Suppliers and their bills: stock goes up, payments settle what is owed, unpaid bills can be reversed. */
import type { Page } from '@playwright/test';

import { createOwner, createStaff, stockQty } from './support/api';
import { SERVICE } from './support/catalog';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { back, expectMoney, id, idStarts, ownerOn, snap, staffOn, tab, text } from './support/ui';

/** A bill: `qty` of the mode's recipe product at `cost` each, plus a delivery charge. */
async function newBill(page: Page, supplier: string, product: string, qty: string, cost: string, delivery?: string) {
  await id(page, 'bills-new').click();
  await id(page, `bill-supplier-${supplier}`).click();
  await id(page, 'bill-invoice').fill(`INV-${uid().slice(-4)}`);
  await id(page, 'bill-add-item').click();
  await id(page, `bill-item-${product}`).click();
  await id(page, 'bill-line-qty-0').fill(qty);
  await id(page, 'bill-line-cost-0').fill(cost);
  if (delivery) {
    await id(page, 'bill-add-other').click();
    await id(page, 'bill-line-desc-1').fill('Delivery');
    await id(page, 'bill-line-cost-1').fill(delivery);
  }
  await id(page, 'bill-save').click();
}

test('owner adds a supplier and a bill; stock goes up; part-pays it in cash; reverses an unpaid bill', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 50_000 });
  const product = SERVICE[mode].product;
  const supplier = `Gulf Beauty ${uid().slice(-4)}`;
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-purchases').click();

  await id(page, 'purchases-tab-suppliers').click();
  await id(page, 'supplier-new').click();
  await id(page, 'supplier-name').fill(supplier);
  await id(page, 'supplier-phone').fill('+971 4 555 0100');
  await id(page, 'supplier-terms').fill('30');
  await id(page, 'supplier-save').click();
  await expect(idStarts(page, `supplier-${supplier}`)).toBeVisible();

  // 100 × 0.25 + 15.00 delivery = 40.00; the stock line adds 100 to stock.
  await newBill(page, supplier, product, '100', '0.25', '15');
  await expect(text(page, 'Bill #1 saved')).toBeVisible();
  await expectMoney(page, 'bill-detail-total', 4000);
  await expect(text(page, 'Unpaid').first()).toBeVisible();
  expect(await stockQty(owner.branchId, owner.businessId, product)).toBe(100);

  await id(page, 'bill-pay').click();
  await id(page, 'pay-amount').fill('20');
  await id(page, 'pay-method-cash').click();
  await id(page, 'pay-confirm').click();
  await expect(text(page, 'Paid AED 20.00')).toBeVisible();
  await expectMoney(page, 'bill-detail-left', 2000);
  await expect(text(page, 'Part paid').first()).toBeVisible();
  await expect(id(page, 'bill-reverse')).toHaveCount(0); // paid bills are not reversed
  await snap(page, 'bill-detail', mode);
  await back(page);

  await expectMoney(page, 'purchases-owed-value', 2000);
  await expectMoney(page, 'purchases-month-value', 4000);

  // A second bill, unpaid, reversed with a reason: its stock goes back out.
  await newBill(page, supplier, product, '10', '0.50');
  await expect(text(page, 'Bill #2 saved')).toBeVisible();
  expect(await stockQty(owner.branchId, owner.businessId, product)).toBe(110);
  await id(page, 'bill-reverse').click();
  await id(page, 'bill-reverse-reason').fill('Goods returned');
  await id(page, 'bill-reverse-confirm').click();
  await expect(text(page, 'Bill reversed')).toBeVisible();
  await expect(text(page, 'Reversed: Goods returned')).toBeVisible();
  expect(await stockQty(owner.branchId, owner.businessId, product)).toBe(100);
  await back(page);
  await snap(page, 'purchases-list', mode);
  await back(page);

  // Home and Accounts: the cash payment left the drawer; the books balance.
  await tab(page, 'index');
  await expectMoney(page, 'kpi-expected-cash-value', 50_000 - 2000);
  await expectMoney(page, 'kpi-money-out-value', 2000);
  await tab(page, 'more');
  await id(page, 'more-accounts').click();
  await expect(text(page, 'Supplier payments (1)')).toBeVisible();
  await id(page, 'accounts-tab-journal').click();
  await expect(id(page, 'journal-purchase_bill')).toHaveCount(2);
  await expect(idStarts(page, 'journal-supplier_payment')).toHaveCount(1);
  await expect(idStarts(page, 'journal-purchase_bill_reversal')).toHaveCount(1);
  await id(page, 'accounts-tab-balance').click();
  await expect(text(page, 'Balanced: Yes')).toBeVisible();
  await expect(id(page, 'tb-supplier_payable')).toContainText('20.00');
});

test('cashier adds a bill but cannot pay or reverse it, and sees no supplier balances', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const cashier = await createStaff(owner, 'cashier');
  const product = SERVICE[mode].product;
  await owner.client.rpc('save_supplier', { p: { business_id: owner.businessId, name: 'Beauty Line Trading', terms_days: 15 } });

  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  await tab(page, 'more');
  await id(page, 'more-purchases').click();
  await expect(id(page, 'purchases-owed')).toHaveCount(0);
  await id(page, 'bills-new').click();
  await expect(text(page, 'The owner records payments to suppliers.')).toBeVisible();
  await expect(id(page, 'bill-paid-now')).toHaveCount(0);
  await back(page);
  await newBill(page, 'Beauty Line Trading', product, '5', '1');
  await expect(text(page, 'Bill #1 saved')).toBeVisible();
  await expect(id(page, 'bill-pay')).toHaveCount(0);
  await expect(id(page, 'bill-reverse')).toHaveCount(0);
  expect(await stockQty(owner.branchId, owner.businessId, product)).toBe(5);
});
