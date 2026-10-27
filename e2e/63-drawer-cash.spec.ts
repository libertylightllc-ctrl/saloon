/** The drawer cannot go below zero (owner's fix list #9: Demo Shop's Home showed -AED 396.92 with no sales). A cash
 * expense bigger than the drawer is refused and says what the drawer holds; the cashier adds the cash the owner put in,
 * on Cash closing; the expense then goes through and Home shows what the drawer should hold. */
import { createOwner, createStaff } from './support/api';
import { expect, test } from './support/fixtures';
import { back, expectMoney, id, snap, staffOn, tab, text } from './support/ui';

test('a cash expense bigger than the drawer is refused; the cash the owner put in is added; then it goes through', async ({ page, mode }) => {
  // No opening cash: the drawer starts empty.
  const owner = await createOwner(mode);
  const cashier = await createStaff(owner, 'cashier');
  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  await expectMoney(page, 'kpi-expected-cash-value', 0);
  await expect(id(page, 'kpi-expected-cash')).toContainText('What the drawer should hold now');

  // AED 50 for tea from an empty drawer: refused, and the form says what the drawer holds.
  await tab(page, 'more');
  await id(page, 'more-expenses').click();
  await id(page, 'expenses-new').click();
  await id(page, 'expense-amount').fill('50');
  await id(page, 'expense-category-tea_food').click();
  await id(page, 'expense-save').click();
  await expect(id(page, 'form-error')).toContainText('There isn’t enough cash in the drawer for this.');
  await expect(id(page, 'form-error')).toContainText('Cash in the drawer: AED 0.00.');
  await snap(page, 'drawer-cash-refused', mode);
  await back(page);
  await back(page);

  // Cash closing → Add cash: AED 100 the owner put in.
  await tab(page, 'index');
  await id(page, 'home-close-day').click();
  await id(page, 'closing-add-cash').click();
  await id(page, 'add-cash-amount').fill('100');
  await expect(id(page, 'add-cash-from-owner')).toHaveAttribute('aria-selected', 'true');
  await id(page, 'add-cash-note').fill('Change for the day');
  await snap(page, 'drawer-cash-add', mode);
  await id(page, 'add-cash-save').click();
  await expect(text(page, 'AED 100.00 added to the drawer')).toBeVisible();
  await expectMoney(page, 'closing-line-cash_added', 10_000);
  await expectMoney(page, 'closing-expected', 10_000);
  await back(page);

  // Now the tea is paid from the drawer, and Home shows the AED 50 left.
  await tab(page, 'more');
  await id(page, 'more-expenses').click();
  await id(page, 'expenses-new').click();
  await id(page, 'expense-amount').fill('50');
  await id(page, 'expense-category-tea_food').click();
  await id(page, 'expense-save').click();
  await expect(text(page, 'Expense saved')).toBeVisible();
  await back(page);
  await tab(page, 'index');
  await expectMoney(page, 'kpi-expected-cash-value', 5_000);
});
