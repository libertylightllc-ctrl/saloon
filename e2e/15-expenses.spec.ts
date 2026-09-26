/** Daily expenses: tea & food, electricity, water, internet, uniforms, dry cleaning — and what they do to the books. */
import type { Page } from '@playwright/test';

import { createOwner, createStaff } from './support/api';
import { expect, test } from './support/fixtures';
import { back, expectMoney, id, idStarts, ownerOn, snap, staffOn, tab, text } from './support/ui';

async function addExpense(page: Page, category: string, amount: string, method: 'cash' | 'card' | 'bank' | null, note?: string) {
  await id(page, 'expense-amount').fill(amount);
  await id(page, `expense-category-${category}`).click();
  if (method) await id(page, `expense-method-${method}`).click();
  if (note) await id(page, 'expense-note').fill(note);
  await id(page, 'expense-save').click();
  await expect(text(page, 'Expense saved')).toBeVisible();
}

test('owner records the salon\'s running costs; cash ones lower expected cash; a reversal puts it back', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 50_000 });
  await ownerOn(page, mode, owner.email, owner.password);

  // From Home's quick action.
  await page.getByRole('button', { name: 'Expense', exact: true }).filter({ visible: true }).first().click();
  await addExpense(page, 'tea_food', '15', 'cash', 'Tea and sugar');

  await tab(page, 'more');
  await id(page, 'more-expenses').click();
  for (const [category, amount, method] of [
    ['electricity', '450', 'bank'],
    ['internet_phone', '299', 'card'],
    ['water', '80', 'bank'],
    ['uniforms', '600', 'card'],
    ['dry_cleaning', '35', 'cash'],
  ] as const) {
    await id(page, 'expenses-new').click();
    await addExpense(page, category, amount, method);
  }
  // The owner's own category.
  await id(page, 'expenses-new').click();
  await id(page, 'expense-category-new').click();
  await id(page, 'expense-category-name').fill('Pest Control');
  await id(page, 'expense-category-save').click();
  await addExpense(page, 'Pest Control', '120', 'bank');

  const total = 1500 + 45_000 + 29_900 + 8_000 + 60_000 + 3_500 + 12_000;
  await expectMoney(page, 'expenses-today-value', total);
  await expectMoney(page, 'expenses-month-value', total);
  await expect(id(page, 'expenses-biggest')).toContainText('Uniforms');
  for (const key of ['tea_food', 'electricity', 'internet_phone', 'water', 'uniforms', 'dry_cleaning', 'custom']) {
    await expect(idStarts(page, `expense-${key}`).first()).toBeVisible();
  }
  await snap(page, 'expenses-list', mode);

  // Home: money out, and only the cash ones came out of the drawer.
  await back(page);
  await tab(page, 'index');
  await expectMoney(page, 'kpi-money-out-value', total);
  await expectMoney(page, 'kpi-expected-cash-value', 50_000 - 1500 - 3500);

  // Accounts: costs per category, and the cash calculation shows the expenses.
  await tab(page, 'more');
  await id(page, 'more-accounts').click();
  await expect(text(page, 'Expenses (2)')).toBeVisible();
  await expectMoney(page, 'cash-expected', 50_000 - 1500 - 3500);
  await expectMoney(page, 'month-costs', total);
  for (const name of ['Electricity', 'Water', 'Internet & Phone', 'Uniforms', 'Dry Cleaning & Laundry', 'Tea & Food', 'Pest Control']) {
    await expect(text(page, name, true).first()).toBeVisible();
  }
  await expect(text(page, 'Balanced: Yes')).toBeVisible();
  await snap(page, 'accounts-with-expenses', mode);
  await back(page);

  // Reverse the tea: it stays, marked reversed; the cash goes back.
  await id(page, 'more-expenses').click();
  await idStarts(page, 'expense-tea_food').first().click();
  await id(page, 'expense-reverse').click();
  await id(page, 'expense-reverse-reason').fill('Entered twice');
  await id(page, 'expense-reverse-confirm').click();
  await expect(text(page, 'Expense reversed')).toBeVisible();
  // Reversing returns to the list, where the expense now shows as reversed.
  await expect(idStarts(page, 'expense-tea_food').first()).toContainText('Reversed');
  await back(page);
  await tab(page, 'index');
  await expectMoney(page, 'kpi-expected-cash-value', 50_000 - 3500);
});

test('cashier records cash expenses only and cannot reverse; staff cannot see expenses', async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { openingCash: 20_000 });
  const cashier = await createStaff(owner, 'cashier');
  const staff = await createStaff(owner, 'staff');

  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  await tab(page, 'more');
  await id(page, 'more-expenses').click();
  await id(page, 'expenses-new').click();
  await expect(text(page, 'Cash from the drawer')).toBeVisible();
  await expect(idStarts(page, 'expense-method-')).toHaveCount(0);
  await expect(id(page, 'expense-category-new')).toHaveCount(0);
  await addExpense(page, 'tea_food', '12', null);
  await idStarts(page, 'expense-tea_food').first().click();
  await expect(id(page, 'expense-detail-amount')).toContainText('12.00');
  await expect(id(page, 'expense-reverse')).toHaveCount(0);
  await back(page);
  await back(page);
  await tab(page, 'index');
  await expectMoney(page, 'kpi-expected-cash-value', 20_000 - 1200);

  const phone = await device();
  await staffOn(phone, mode, owner.code, staff.username, staff.password);
  await tab(phone, 'more');
  await expect(id(phone, 'more-expenses')).toHaveCount(0);
  await phone.goto('/expenses/new');
  await expect(id(phone, 'tab-index')).toHaveAttribute('aria-selected', 'true');
});
