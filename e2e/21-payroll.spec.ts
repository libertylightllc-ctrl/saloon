/** Payroll: an advance and a bonus → work out the month → approve → the barber sees the payslip → pay by bank
 * → WPS proof; the books balance; a cashier never reaches payroll. */
import path from 'path';

import { createOwner, createStaff, employeeOf, sellCustom } from './support/api';
import { expect, test } from './support/fixtures';
import { back, expectMoney, id, ownerOn, staffOn, tab, text } from './support/ui';

test('owner runs the month: advance, bonus, generate, approve, pay, WPS proof; the barber sees the payslip', async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { openingCash: 100_000 });
  const barber = await createStaff(owner, 'staff'); // 10% commission
  const cashier = await createStaff(owner, 'cashier');
  const employee = await employeeOf(barber.memberId);
  await owner.client.rpc('save_employee', {
    p: { business_id: owner.businessId, id: employee, full_name: barber.name, base_salary_minor: 350_000, commission_bps: 1000, wps_required: true },
  });
  await sellCustom(owner.client, owner, { card: 10_000, employeeId: employee }); // AED 10.00 commission

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-staff').click();
  await id(page, 'staff-payroll').click();
  await id(page, 'payroll-adjustments').click();
  for (const [kind, amount] of [['advance', '500'], ['bonus', '200']] as const) {
    await id(page, 'adjustment-new').click();
    await id(page, `adjustment-person-${barber.name}`).click();
    await id(page, `adjustment-kind-${kind}`).click();
    await id(page, 'adjustment-amount').fill(amount);
    if (kind === 'advance') await id(page, 'adjustment-method-cash').click();
    await id(page, 'adjustment-save').click();
    await expect(text(page, 'Saved', true)).toBeVisible();
  }
  await expect(id(page, `adjustment-advance-${barber.name}`)).toContainText('500.00');
  await back(page);

  // 3,500 + 10 commission + 200 bonus − 500 advance = 3,210.
  await id(page, 'payroll-generate').click();
  await expect(text(page, 'Payroll worked out')).toBeVisible();
  await expect(id(page, `slip-${barber.name}`)).toContainText('3,210.00');
  await id(page, 'payroll-approve').click();
  await expect(text(page, 'Payroll approved and posted to the books')).toBeVisible();

  // The barber's My pay tab.
  const phone = await device();
  await staffOn(phone, mode, owner.code, barber.username, barber.password);
  await tab(phone, 'pay');
  await expectMoney(phone, 'mypay-commission-value', 1_000);
  await expect(id(phone, 'mypay-advance')).toContainText('500.00');
  const slip = phone.locator('[data-testid^="mypay-slip-"]').filter({ visible: true }).first();
  await expect(slip).toContainText('3,210.00');
  await expect(slip).toContainText('To pay');

  // Pay by bank, then the WPS proof.
  await id(page, `slip-${barber.name}`).click();
  await expectMoney(page, 'slip-net', 321_000);
  await id(page, 'slip-pay-bank').click();
  await expect(text(page, `${barber.name} paid`)).toBeVisible();
  await id(page, `slip-${barber.name}`).click();
  const chooser = page.waitForEvent('filechooser');
  await id(page, 'receipt-choose').click();
  await (await chooser).setFiles(path.join(__dirname, 'fixtures', 'receipt.jpg'));
  await expect(text(page, 'WPS proof added')).toBeVisible();
  await expect(text(page, 'WPS proven').first()).toBeVisible();
  await phone.reload();
  await expect(phone.locator('[data-testid^="mypay-slip-"]').filter({ visible: true }).first()).toContainText('Paid');

  // The books: the advance, the month and the payment; balanced.
  await page.goto('/accounts');
  await id(page, 'accounts-tab-journal').click();
  await expect(id(page, 'journal-staff_advance')).toHaveCount(1);
  await expect(id(page, 'journal-payroll')).toHaveCount(1);
  await expect(id(page, 'journal-payroll_payment')).toHaveCount(1);
  await id(page, 'accounts-tab-balance').click();
  await expect(text(page, 'Balanced: Yes')).toBeVisible();
  await expect(id(page, 'tb-salaries_expense')).toContainText('3,700.00'); // base + bonus
  await expect(id(page, 'tb-commission_expense')).toContainText('10.00');
  await expect(id(page, 'tb-salaries_payable')).not.toContainText('AED'); // nothing left owed
  await expect(id(page, 'tb-staff_advances')).not.toContainText('AED'); // advance recovered

  // A cashier never reaches payroll.
  const till = await device();
  await staffOn(till, mode, owner.code, cashier.username, cashier.password);
  await till.goto('/payroll');
  await expect(id(till, 'tab-index')).toHaveAttribute('aria-selected', 'true');
});
