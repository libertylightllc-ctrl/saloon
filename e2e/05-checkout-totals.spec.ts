import type { Page } from '@playwright/test';

import { createOwner, latestSale, vatInclusive, type Mode } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { back, expectMoney, field, id, ownerOn, snap, tab, text } from './support/ui';

const DISCOUNT = 1000;
const TIP = 500;

/** Two of the mode's service, 10.00 off, 5.00 tip, paid as a split. */
async function splitSale(page: Page, mode: Mode, vatOn: boolean, split: [string, string][]) {
  const svc = SERVICE[mode];
  const subtotal = svc.price * 2;
  const net = subtotal - DISCOUNT;
  const due = net + TIP;

  await tab(page, 'sale');
  await id(page, `tile-${svc.name}-add`).click();
  await id(page, `tile-${svc.name}-plus`).click();
  await expectMoney(page, 'basket-total', subtotal);
  await id(page, 'checkout').click();
  await id(page, 'discount').fill((DISCOUNT / 100).toFixed(2));
  await id(page, 'tip').fill((TIP / 100).toFixed(2));
  await expectMoney(page, 'checkout-due', due);
  if (vatOn) await expect(id(page, 'checkout-vat')).toContainText((vatInclusive(net) / 100).toFixed(2));
  else await expect(id(page, 'checkout-vat')).not.toContainText('AED');

  await id(page, 'pay-split').click();
  // Part-paid: the rest is shown and saving is blocked.
  await id(page, `split-${split[0]![0]}`).fill('1.00');
  await expect(id(page, 'split-remaining')).toContainText(((due - 100) / 100).toFixed(2));
  await expect(id(page, 'save-sale')).toHaveAttribute('aria-disabled', 'true');
  for (const [method, amount] of split) await id(page, `split-${method}`).fill(amount);
  await expect(id(page, 'split-remaining')).toContainText('0.00');
  await snap(page, `split-${vatOn ? 'vat' : 'novat'}`, mode);
  await id(page, 'save-sale').click();
  await expect(id(page, 'sale-done')).toBeVisible();
  await expectMoney(page, 'sale-done-total', due);
  await id(page, 'new-sale').click();
  return { subtotal, net, due };
}

async function expectSaleRow(branchId: string, vatOn: boolean, expected: { subtotal: number; net: number; due: number }, split: [string, string][]) {
  const sale = await latestSale(branchId);
  expect(sale.subtotal_minor).toBe(expected.subtotal);
  expect(sale.discount_minor).toBe(DISCOUNT);
  expect(sale.tip_minor).toBe(TIP);
  expect(sale.total_minor).toBe(expected.due);
  expect(sale.vat_minor).toBe(vatOn ? vatInclusive(expected.net) : 0);
  expect(sale.vat_mode).toBe(vatOn ? 'on' : 'off');
  expect(sale.sale_payments.map((p) => [p.method, p.amount_minor]).sort()).toEqual(
    split.map(([m, a]) => [m, Math.round(Number(a) * 100)]).sort(),
  );
}

test('split payment with discount and tip, VAT off then on', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);

  const due = SERVICE[mode].price * 2 - DISCOUNT + TIP;
  const splitA: [string, string][] = [['cash', '20.00'], ['card', ((due - 2000) / 100).toFixed(2)]];
  const a = await splitSale(page, mode, false, splitA);
  await expectSaleRow(owner.branchId, false, a, splitA);

  // Turn VAT on in branch settings (needs the TRN).
  await tab(page, 'more');
  await id(page, 'more-branch').click();
  await id(page, 'branch-vat').click();
  await field(page, 'trn').fill('12345');
  await id(page, 'branch-save').click();
  await expect(text(page, 'The TRN has 15 digits')).toBeVisible();
  await field(page, 'trn').fill('100234567800003');
  await id(page, 'branch-save').click();
  await expect(text(page, 'Settings saved')).toBeVisible();
  await back(page);

  const splitB: [string, string][] = [['card', '30.00'], ['wallet', ((due - 3000) / 100).toFixed(2)]];
  const b = await splitSale(page, mode, true, splitB);
  await expectSaleRow(owner.branchId, true, b, splitB);
});

test('the same checkout in Arabic (right-to-left), VAT on', async ({ page, mode }) => {
  const owner = await createOwner(mode, { vat: true });
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-language').click();
  await page.getByRole('button', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(id(page, 'tab-sale')).toContainText('البيع');

  const due = SERVICE[mode].price * 2 - DISCOUNT + TIP;
  const split: [string, string][] = [['cash', '5.00'], ['card', ((due - 500) / 100).toFixed(2)]];
  const r = await splitSale(page, mode, true, split);
  await expectSaleRow(owner.branchId, true, r, split);
  await tab(page, 'index');
  await expectMoney(page, 'kpi-sales-value', r.due);
  await snap(page, 'home-arabic', mode);
});
