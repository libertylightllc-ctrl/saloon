import { admin, createOwner, createStaff, journalTotals, sellService, staffEmail, userClient } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { back, expectMoney, id, ownerOn, staffOn, tab, text } from './support/ui';

test('owner refunds part of a sale with a reason; the front desk refunds only with the owner’s PIN', async ({ page, mode, device }) => {
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

  // The front desk may refund, but only with the owner's or a manager's PIN on the same phone (brief B2)…
  const pin = await owner.client.rpc('set_my_pin', { p_business: owner.businessId, p_pin: '2468' });
  if (pin.error) throw pin.error;
  const phone = await device();
  await staffOn(phone, mode, owner.code, cashier.username, cashier.password);
  await tab(phone, 'more');
  await id(phone, 'more-sales').click();
  await id(phone, `sale-row-${sale.number}`).click();
  await expectMoney(phone, 'sale-total', svc.price);
  await id(phone, 'sale-refund').click();
  await id(phone, 'refund-amount').fill('1.00');
  await id(phone, 'refund-reason').fill('Wrong change given');
  await id(phone, 'refund-confirm').click();
  await expect(id(phone, 'approval-title')).toHaveText('Manager approval needed');
  await expect(id(phone, 'approval-summary')).toHaveText(`Refund AED 1.00 · sale #${sale.number}`);
  await id(phone, `approver-${owner.name}`).click();
  await id(phone, 'approval-pin').fill('2468');
  await id(phone, 'approval-approve').click();
  await expect(text(phone, 'Refunded AED 1.00')).toBeVisible();
  const { data: after } = await admin.from('sales').select('refunded_minor').eq('id', sale.sale_id).single();
  expect(after?.refunded_minor).toBe(part + 100);

  // …and the server refuses a front-desk refund without one.
  const cashierApi = await userClient(staffEmail(owner.code, cashier.username), cashier.password);
  const { error } = await cashierApi.rpc('refund_sale', {
    p: { sale_id: sale.sale_id, amount_minor: 100, method: 'cash', reason: 'Trying', idempotency_key: crypto.randomUUID() },
  });
  expect(error?.message).toMatch(/approval_needed/);
});
