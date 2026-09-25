/** The owner's books: calculations, journal, trial balance and history — and nobody else sees them. */
import { createOwner, createStaff, refundSale, sellService } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { expectMoney, id, idStarts, ownerOn, snap, staffOn, tab, text } from './support/ui';

test('owner sees how the numbers are made up, the journal, a balanced trial balance and the history', async ({ page, mode }) => {
  const svc = SERVICE[mode];
  const owner = await createOwner(mode, { openingCash: 20_000 });
  const cashSale = await sellService(owner.client, owner, svc.name, 'cash');
  await sellService(owner.client, owner, svc.name, 'card');
  await refundSale(owner, cashSale.sale_id, 1000);
  const expectedCash = 20_000 + svc.price - 1000;

  await ownerOn(page, mode, owner.email, owner.password);
  await expectMoney(page, 'kpi-expected-cash-value', expectedCash);
  await expect(text(page, 'View audit trail')).toBeVisible();
  await tab(page, 'more');
  await id(page, 'more-accounts').click();

  // Overview: opening cash + cash sale − cash refund = the same expected cash as Home (card is not in the drawer).
  await expect(text(page, 'Opening cash (1)')).toBeVisible();
  await expect(text(page, 'Sales (1)')).toBeVisible();
  await expect(text(page, 'Refunds (1)')).toBeVisible();
  await expectMoney(page, 'cash-expected', expectedCash);
  // This month: both sales, less the refund; nothing is left unbalanced.
  await expectMoney(page, 'month-revenue', svc.price * 2 - 1000);
  await expect(text(page, 'Balanced: Yes')).toBeVisible();
  await snap(page, 'accounts-overview', mode);

  // Journal: every event has an entry with its debit and credit lines.
  await id(page, 'accounts-tab-journal').click();
  await expect(idStarts(page, 'journal-sale')).toHaveCount(2);
  await expect(idStarts(page, 'journal-refund')).toHaveCount(1);
  await expect(idStarts(page, 'journal-opening_cash')).toHaveCount(1);
  await idStarts(page, 'journal-sale').first().click();
  expect(await id(page, 'journal-line').count()).toBeGreaterThanOrEqual(2);
  await snap(page, 'accounts-journal', mode);

  // Trial balance: debits = credits.
  await id(page, 'accounts-tab-balance').click();
  await expect(text(page, 'Balanced: Yes')).toBeVisible();
  const debits = await id(page, 'tb-debits').innerText();
  expect(debits).toBe(await id(page, 'tb-credits').innerText());
  await expect(id(page, 'tb-cash')).toContainText('Cash');
  await snap(page, 'accounts-trial-balance', mode);

  // History: who did what, and who signed in.
  await id(page, 'accounts-tab-history').click();
  await expect(idStarts(page, 'history-row').filter({ hasText: `Saved sale #${cashSale.number}` })).toBeVisible();
  await id(page, 'history-kind-signins').click();
  await expect(idStarts(page, 'signin-row').filter({ hasText: owner.name }).first()).toBeVisible();
  await snap(page, 'accounts-history', mode);
});

test('cashier and staff never see the books or the history', async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { openingCash: 20_000 });
  const cashier = await createStaff(owner, 'cashier');
  const staff = await createStaff(owner, 'staff');
  await sellService(owner.client, owner, SERVICE[mode].name, 'cash');

  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  await expectMoney(page, 'kpi-expected-cash-value', 20_000 + SERVICE[mode].price);
  await expect(text(page, 'Recent activity')).toHaveCount(0);
  await expect(text(page, 'View audit trail')).toHaveCount(0);
  await tab(page, 'more');
  await expect(id(page, 'more-accounts')).toHaveCount(0);
  await page.goto('/accounts');
  await expect(id(page, 'tab-index')).toHaveAttribute('aria-selected', 'true');

  const phone = await device();
  await staffOn(phone, mode, owner.code, staff.username, staff.password);
  await tab(phone, 'more');
  await expect(id(phone, 'more-accounts')).toHaveCount(0);
  await phone.goto('/accounts?tab=history');
  await expect(id(phone, 'tab-index')).toHaveAttribute('aria-selected', 'true');
});
