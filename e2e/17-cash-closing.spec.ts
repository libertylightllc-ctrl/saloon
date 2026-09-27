/** Daily cash closing: tips paid from the drawer, short by AED 5 → cashier submits → owner sends back,
 * then approves → the day is locked, the difference is posted to Cash over/short, the books balance. */
import { createOwner, createStaff, dubaiDate, employeeOf, sellCustom, staffEmail, userClient } from './support/api';
import { expect, test } from './support/fixtures';
import { back, expectMoney, id, ownerOn, snap, staffOn, tab, text } from './support/ui';

test('cashier pays tips and submits a count AED 5 short; owner sends it back, then approves; the day locks', async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { openingCash: 20_000 });
  const cashier = await createStaff(owner, 'cashier');
  const barber = await createStaff(owner, 'staff');
  const employee = await employeeOf(barber.memberId);
  const till = await userClient(staffEmail(owner.code, cashier.username), cashier.password);
  await sellCustom(till, owner, { cash: 5000 });
  await sellCustom(till, owner, { cash: 2500, tip: 1000, employeeId: employee });
  await sellCustom(till, owner, { card: 3500, tip: 500, employeeId: employee });
  const today = dubaiDate();

  // Cashier: Home → Close day. Expected = 200 opening + 50 + 25 cash sales (card is not in the drawer).
  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  await id(page, 'home-close-day').click();
  await expectMoney(page, 'closing-expected', 27_500);
  await expectMoney(page, 'closing-line-opening_cash', 20_000);
  await expectMoney(page, 'closing-line-sale', 7_500);

  // Tips: 10.00 cash + 5.00 card tip are owed; pay 10.00 out of the drawer.
  await expect(id(page, `tips-${barber.name}`)).toContainText('AED 15.00');
  await id(page, `tips-pay-${barber.name}`).click();
  await id(page, 'tips-amount').fill('10');
  await id(page, 'tips-confirm').click();
  await expect(text(page, `Paid AED 10.00 tips to ${barber.name}`)).toBeVisible();
  await expectMoney(page, 'closing-expected', 26_500);
  await expectMoney(page, 'closing-line-tip_payout', -1_000);
  await expect(id(page, `tips-${barber.name}`)).toContainText('AED 5.00');

  // Count with the notes helper: 2 × 100 + 1 × 50 + 1 × 10 = 260.00, i.e. short by 5.00.
  await id(page, 'closing-count-notes').click();
  await id(page, 'denom-10000').fill('2');
  await id(page, 'denom-5000').fill('1');
  await id(page, 'denom-1000').fill('1');
  await expect(id(page, 'denom-total')).toContainText('AED 260.00');
  await id(page, 'denom-done').click();
  await expect(id(page, 'closing-variance')).toContainText('Short by AED 5.00');
  await expect(id(page, 'closing-submit')).toBeDisabled();
  await id(page, 'closing-reason').fill('Change given twice');
  await id(page, 'closing-confirm').click();
  await snap(page, 'closing-count', mode);
  await id(page, 'closing-submit').click();
  await expect(text(page, 'Sent to the owner for approval')).toBeVisible();
  await expect(text(page, 'Pending approval').first()).toBeVisible();

  // The drawer is closed to cash; card still works.
  await expect(sellCustom(till, owner, { cash: 1000 })).rejects.toMatchObject({ message: 'day_closed' });
  await sellCustom(till, owner, { card: 1000 });

  // Owner: Home asks for approval. Send it back first.
  const phone = await device();
  await ownerOn(phone, mode, owner.email, owner.password);
  await expect(id(phone, `attention-close-${today}`)).toContainText('Difference -AED 5.00');
  await id(phone, `attention-close-${today}-action`).click();
  await expect(id(phone, 'closing-summary-counted')).toContainText('260.00');
  await id(phone, 'closing-send-back').click();
  await id(phone, 'closing-send-back-reason').fill('Count the coins again');
  await id(phone, 'closing-send-back-confirm').click();
  await expect(text(phone, 'Sent back for a recount')).toBeVisible();

  // Cashier sees why, recounts (same figure) and submits again.
  await expect(id(page, 'closing-returned')).toContainText('Count the coins again');
  await expect(id(page, 'closing-reason')).toHaveValue('Change given twice');
  await id(page, 'closing-confirm').click();
  await id(page, 'closing-submit').click();
  await expect(text(page, 'Sent to the owner for approval')).toBeVisible();

  // Owner approves: locked, 5.00 posted to Cash over/short, the drawer now holds what was counted.
  await expect(id(phone, 'closing-approve')).toBeVisible();
  await id(phone, 'closing-approve').click();
  await expect(text(phone, 'Day closed and locked')).toBeVisible();
  await expect(text(phone, 'Approved').first()).toBeVisible();
  await snap(phone, 'closing-approved', mode);
  await back(phone);
  await expectMoney(phone, 'kpi-expected-cash-value', 26_000);
  await expect(text(phone, 'Day closed', true)).toBeVisible();
  await tab(phone, 'more');
  await id(phone, 'more-accounts').click();
  await id(phone, 'accounts-tab-journal').click();
  await expect(id(phone, 'journal-cash_close')).toHaveCount(1);
  await expect(id(phone, 'journal-tip_payout')).toHaveCount(1);
  await id(phone, 'accounts-tab-balance').click();
  await expect(text(phone, 'Balanced: Yes')).toBeVisible();
  await expect(id(phone, 'tb-cash_over_short')).toContainText('5.00');

  // History on the cashier's phone.
  await back(page);
  await tab(page, 'more');
  await id(page, 'more-cashClosing').click();
  await expect(id(page, `closing-day-${today}`)).toContainText('Approved');
  await expect(id(page, `closing-day-${today}`)).toContainText('-AED 5.00');
});

test('owner counts and approves in one step, banks part of it; staff cannot open cash closing', async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { openingCash: 20_000 });
  const staff = await createStaff(owner, 'staff');
  await sellCustom(owner.client, owner, { cash: 3000 });

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-cashClosing').click();
  await expectMoney(page, 'closing-expected', 23_000);
  await id(page, 'closing-counted').fill('230');
  await expect(id(page, 'closing-variance')).toContainText('Balanced');
  await expect(id(page, 'closing-reason')).toHaveCount(0);
  await id(page, 'closing-taken-out').fill('150');
  await id(page, 'closing-taken-to-bank').click();
  await id(page, 'closing-confirm').click();
  await id(page, 'closing-approve').click();
  await expect(text(page, 'Day closed and locked')).toBeVisible();
  await expect(text(page, 'Taken out to the bank')).toBeVisible();
  await back(page);
  await tab(page, 'index');
  // Tomorrow opens with counted − taken out.
  await expectMoney(page, 'kpi-expected-cash-value', 8_000);
  await tab(page, 'more');
  await id(page, 'more-accounts').click();
  await id(page, 'accounts-tab-balance').click();
  await expect(id(page, 'tb-bank')).toContainText('150.00');
  await expect(text(page, 'Balanced: Yes')).toBeVisible();

  const phone = await device();
  await staffOn(phone, mode, owner.code, staff.username, staff.password);
  await expect(id(phone, 'home-close-day')).toHaveCount(0);
  await tab(phone, 'more');
  await expect(id(phone, 'more-cashClosing')).toHaveCount(0);
  await phone.goto('/cash-closing');
  await expect(id(phone, 'tab-index')).toHaveAttribute('aria-selected', 'true');
});
