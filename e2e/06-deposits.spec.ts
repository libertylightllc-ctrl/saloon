import type { Page } from '@playwright/test';

import { appointmentFor, createOwner, dubaiDate, journalTotals } from './support/api';
import { SERVICE } from './support/catalog';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { expectMoney, id, idStarts, ownerOn, tab, text } from './support/ui';

const DEPOSIT = 5000;

/** Books the mode's service two days ahead at `time`, for a new customer, with a cash deposit. */
async function book(page: Page, service: string, customer: string, time: string) {
  await tab(page, 'queue');
  await id(page, 'queue-new').click();
  await id(page, 'appt-kind-booking').click();
  await id(page, 'add-customer-inline').click();
  await id(page, 'new-customer-name').fill(customer);
  await id(page, 'save-new-customer').click();
  await expect(id(page, 'picked-customer')).toContainText(customer);
  await id(page, `pick-service-${service}`).click();
  await id(page, `date-${dubaiDate(2)}`).click();
  await id(page, `slot-${time}`).click();
  await id(page, 'deposit').fill((DEPOSIT / 100).toFixed(2));
  await id(page, 'deposit-method-cash').click();
  await id(page, 'appointment-submit').click();
  await expect(text(page, `Booked ${customer}`)).toBeVisible();
}

async function openMenu(page: Page, customer: string) {
  await tab(page, 'queue');
  await id(page, 'queue-day-week').click();
  const row = idStarts(page, 'queue-row-').filter({ hasText: customer });
  await expect(row).toBeVisible();
  await row.locator('[data-testid^="queue-more-"]').click();
}

test('a deposit is kept on no-show (+1 no-show) and refunded on an early cancel', async ({ page, mode }) => {
  const svc = SERVICE[mode];
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);

  // Booking 1 → no-show: the deposit is forfeited and the customer gets a no-show.
  const late = `Late ${uid().slice(-4)}`;
  await book(page, svc.name, late, '10:00');
  expect((await appointmentFor(owner.branchId, late)).deposit_status).toBe('held');
  await tab(page, 'index');
  await expectMoney(page, 'kpi-expected-cash-value', DEPOSIT);

  await openMenu(page, late);
  await expect(text(page, /refunded if cancelled 12 h or more before/)).toBeVisible();
  await id(page, 'action-no-show').click();
  await expect(text(page, `Marked ${late} as no-show`)).toBeVisible();
  const noShow = await appointmentFor(owner.branchId, late);
  expect(noShow.status).toBe('no_show');
  expect(noShow.deposit_status).toBe('forfeited');

  await tab(page, 'customers');
  await id(page, `customer-${late}`).click();
  await expect(id(page, 'customer-no-shows-value')).toHaveText('1');
  await page.getByRole('button', { name: 'Back' }).filter({ visible: true }).first().click();

  // Booking 2 → cancelled two days ahead (before the 12 h cut-off): the deposit goes back.
  const early = `Early ${uid().slice(-4)}`;
  await book(page, svc.name, early, '11:00');
  await tab(page, 'index');
  await expectMoney(page, 'kpi-expected-cash-value', DEPOSIT * 2);
  await openMenu(page, early);
  await id(page, 'action-cancel').click();
  await expect(id(page, 'confirm-cancel')).toHaveAttribute('aria-disabled', 'true'); // needs a reason
  await id(page, 'cancel-reason').fill('Customer travelling');
  await id(page, 'confirm-cancel').click();
  await expect(text(page, `Cancelled ${early}. Deposit refunded.`)).toBeVisible();
  const cancelled = await appointmentFor(owner.branchId, early);
  expect(cancelled.status).toBe('cancelled');
  expect(cancelled.deposit_status).toBe('refunded');

  // Kept deposit stays in the drawer; the refunded one left it.
  await tab(page, 'index');
  await expectMoney(page, 'kpi-expected-cash-value', DEPOSIT);
  const books = await journalTotals(owner.businessId);
  expect(books.debit).toBe(books.credit);
});
