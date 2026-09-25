import { createOwner, createStaff, journalTotals, stockQty } from './support/api';
import { SERVICE } from './support/catalog';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { back, expectMoney, id, idStarts, ownerOn, snap, staffOn, tab, text } from './support/ui';

test('walk-in syncs to the other phone within 2 s, then start → complete → checkout → cash', async ({ page, mode, device }) => {
  const svc = SERVICE[mode];
  const owner = await createOwner(mode, { openingCash: 20_000 });
  await createStaff(owner, 'staff', { name: svc.staff, commissionBps: 1000 });
  const cashier = await createStaff(owner, 'cashier');
  const customer = `Omar ${uid().slice(-4)}`;

  // Phone A: owner watching the queue. Phone B: cashier at the front desk.
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'queue');
  await expect(text(page, 'No one is waiting. Add a walk-in.')).toBeVisible();
  const phoneB = await device();
  await staffOn(phoneB, mode, owner.code, cashier.username, cashier.password);
  await tab(phoneB, 'queue');
  await id(phoneB, 'queue-new').click();
  await id(phoneB, 'add-customer-inline').click();
  await id(phoneB, 'new-customer-name').fill(customer);
  await id(phoneB, 'new-customer-phone').fill('+971 50 123 4567');
  await id(phoneB, 'save-new-customer').click();
  await expect(id(phoneB, 'picked-customer')).toContainText(customer);
  await id(phoneB, `pick-service-${svc.name}`).click();
  await id(phoneB, `staff-${svc.staff}`).click();
  await id(phoneB, 'appointment-submit').click();
  await expect(text(phoneB, `${customer} added to the queue`)).toBeVisible();

  // Realtime: the owner's phone shows it within 2 seconds, no refresh.
  const start = idStarts(page, 'queue-start-');
  await expect(start).toBeVisible({ timeout: 2_000 });
  await expect(text(page, customer).first()).toBeVisible();

  await start.click();
  const complete = idStarts(page, 'queue-complete-');
  await expect(complete).toBeVisible();
  // …and B sees it move to in progress.
  await expect(idStarts(phoneB, 'queue-complete-')).toBeVisible({ timeout: 2_000 });
  await complete.click();

  // Checkout is pre-filled from the appointment.
  await expectMoney(page, 'basket-total', svc.price);
  await id(page, 'checkout').click();
  await expect(id(page, 'picked-customer')).toContainText(customer);
  await expect(id(page, `checkout-staff-${svc.staff}`)).toHaveAttribute('aria-selected', 'true');
  await expectMoney(page, 'checkout-due', svc.price);
  await expect(id(page, 'pay-cash')).toHaveAttribute('aria-selected', 'true');
  await snap(page, 'checkout', mode);
  await id(page, 'save-sale').click();
  await expect(id(page, 'sale-done')).toBeVisible();
  await expectMoney(page, 'sale-done-total', svc.price);
  await snap(page, 'sale-done', mode);
  await id(page, 'new-sale').click();

  // Recent sales.
  await tab(page, 'more');
  await id(page, 'more-sales').click();
  await expect(id(page, 'sale-row-1001')).toContainText(customer);
  await back(page);

  // Home: sales and expected cash, on both phones.
  await tab(page, 'index');
  await expectMoney(page, 'kpi-sales-value', svc.price);
  await expectMoney(page, 'kpi-expected-cash-value', 20_000 + svc.price);
  await tab(phoneB, 'index');
  await expectMoney(phoneB, 'kpi-sales-value', svc.price, 5_000);
  await snap(page, 'home-after-sale', mode);

  // Customer visit recorded.
  await tab(page, 'customers');
  await id(page, `customer-${customer}`).click();
  await expect(id(page, 'customer-visits-value')).toHaveText('1');

  // Stock used by the recipe, and the books balance.
  expect(await stockQty(owner.branchId, owner.businessId, svc.product)).toBe(-svc.uses);
  const books = await journalTotals(owner.businessId);
  expect(books.debit).toBe(books.credit);
  expect(books.entries).toBeGreaterThanOrEqual(2);
});
