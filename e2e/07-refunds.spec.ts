import { admin, createOwner, createStaff, journalTotals, sellService, staffEmail, userClient } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { back, expectMoney, id, ownerOn, staffOn, tab, text } from './support/ui';

test('owner refunds part of a sale with a reason; a cashier cannot refund', async ({ page, mode, device }) => {
  const svc = SERVICE[mode];
  const owner = await createOwner(mode, { openingCash: 10_000 });
  const cashier = await createStaff(owner, 'cashier');
  const sale = await sellService(owner.client, owner, svc.name);
  const part = 1000;

  await ownerOn(page, mode, owner.email, owner.password);
  await expectMoney(page, 'kpi-expected-cash-value', 10_000 + svc.price);
  await tab(page, 'more');
  await id(page, 'more-sales').click();
  await id(page, `sale-row-${sale.number}`).click();
  await expectMoney(page, 'sale-total', svc.price);
  await id(page, 'sale-refund').click();
  await expect(text(page, `Up to AED ${(svc.price / 100).toFixed(2)} can be refunded.`)).toBeVisible();
  await id(page, 'refund-amount').fill((part / 100).toFixed(2));
  await expect(id(page, 'refund-confirm')).toHaveAttribute('aria-disabled', 'true'); // reason required
  await id(page, 'refund-reason').fill('Unhappy with the fade');
  await id(page, 'refund-method-cash').click();
  await id(page, 'refund-confirm').click();
  await expect(text(page, `Refunded AED ${(part / 100).toFixed(2)}`)).toBeVisible();
  await expect(text(page, 'Unhappy with the fade')).toBeVisible();
  await expect(text(page, 'Part refunded').first()).toBeVisible();

  const { data: row } = await admin.from('sales').select('refunded_minor, status, total_minor').eq('id', sale.sale_id).single();
  expect(row).toMatchObject({ refunded_minor: part, status: 'partially_refunded', total_minor: svc.price });
  const books = await journalTotals(owner.businessId);
  expect(books.debit).toBe(books.credit);
  await back(page);
  await back(page);
  await tab(page, 'index');
  await expectMoney(page, 'kpi-expected-cash-value', 10_000 + svc.price - part);

  // The cashier can open the sale but has no refund button…
  const phone = await device();
  await staffOn(phone, mode, owner.code, cashier.username, cashier.password);
  await tab(phone, 'more');
  await id(phone, 'more-sales').click();
  await id(phone, `sale-row-${sale.number}`).click();
  await expectMoney(phone, 'sale-total', svc.price);
  await expect(id(phone, 'sale-refund')).toHaveCount(0);

  // …and the server refuses a refund from a cashier session anyway.
  const cashierApi = await userClient(staffEmail(owner.code, cashier.username), cashier.password);
  const { error } = await cashierApi.rpc('refund_sale', {
    p: { sale_id: sale.sale_id, amount_minor: 100, method: 'cash', reason: 'Trying', idempotency_key: crypto.randomUUID() },
  });
  expect(error?.message).toMatch(/not_allowed/);
});
