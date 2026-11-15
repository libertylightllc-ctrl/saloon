import { admin, createOwner, createStaff, employeeOf, journalTotals, sellService, staffEmail, userClient } from './support/api';
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

// A stylist opening their own part-refunded sale sees the refund, its reason and what it took from them, read only
// (owner's app check E7).
test('a stylist sees the refund on their own sale and what it changed for them', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 10_000 });
  const stylist = await createStaff(owner, 'staff', { commissionBps: 3500 });
  const emp = await employeeOf(stylist.memberId);
  const { data: sale, error } = await owner.client.rpc('create_sale', {
    p: {
      branch_id: owner.branchId,
      client_ref: crypto.randomUUID(),
      employee_id: emp,
      tip_minor: 500,
      tip_employee_id: emp,
      lines: [{ kind: 'custom', name: 'Blow dry', unit_price_minor: 4000, employee_id: emp }],
      payments: [{ method: 'cash', amount_minor: 4500 }],
    },
  });
  if (error) throw error;
  const { sale_id, number } = sale as { sale_id: string; number: number };
  const refund = await owner.client.rpc('refund_sale', {
    p: { sale_id, amount_minor: 1000, method: 'cash', reason: 'TEST partial refund', idempotency_key: crypto.randomUUID() },
  });
  if (refund.error) throw refund.error;
  // Stylists see their own sales when the owner lets them take payments (Controls).
  const rules = await owner.client.rpc('update_branch', { p_branch: owner.branchId, p: { settings: { staff_can_sell: true } } });
  if (rules.error) throw rules.error;

  await staffOn(page, mode, owner.code, stylist.username, stylist.password);
  await tab(page, 'more');
  await id(page, 'more-mySales').click();
  await id(page, `sale-row-${number}`).click();
  await expect(text(page, 'Part refunded')).toBeVisible();
  await expect(text(page, 'TEST partial refund')).toBeVisible();
  // QAR/AED 10 of a 40 sale (the tip apart): a quarter of the 35% commission on 40 comes back; the tip is kept.
  await expect(id(page, 'refund-my-commission')).toHaveText(/^Your commission: -AED\s3\.50$/);
  await expect(id(page, 'refund-my-tip')).toHaveText('Your tip is kept');
  // Read only: no refund button for a stylist.
  await expect(id(page, 'sale-refund')).toHaveCount(0);
});
