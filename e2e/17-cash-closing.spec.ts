/** Daily cash closing: tips paid from the drawer, a blind count short by AED 5 → the front desk sends it → owner sends
 * back, then approves → the day is locked, the difference is posted to Cash over/short, the books balance. */
import { createOwner, createStaff, dubaiDate, employeeOf, sellCustom, staffEmail, userClient } from './support/api';
import { expect, test } from './support/fixtures';
import { back, expectMoney, id, ownerOn, snap, staffOn, tab, text } from './support/ui';

test('the front desk pays tips and sends a blind count AED 5 short; owner sends it back, then approves; the day locks', async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { openingCash: 20_000 });
  const cashier = await createStaff(owner, 'cashier');
  const barber = await createStaff(owner, 'staff');
  const employee = await employeeOf(barber.memberId);
  const till = await userClient(staffEmail(owner.code, cashier.username), cashier.password);
  await sellCustom(till, owner, { cash: 5000 });
  await sellCustom(till, owner, { cash: 2500, tip: 1000, employeeId: employee });
  await sellCustom(till, owner, { card: 3500, tip: 500, employeeId: employee });
  const today = dubaiDate();

  // Front desk: Home → Close day. Blind count (brief B4): nothing that adds up to the expected cash shows yet.
  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  await id(page, 'home-close-day').click();
  await expect(id(page, 'closing-blind')).toContainText('Blind count');
  await expect(id(page, 'closing-expected')).toHaveCount(0);
  await expect(id(page, 'closing-line-sale')).toHaveCount(0);

  // Tips: 10.00 cash + 5.00 card tip are owed; pay 10.00 out of the drawer.
  await expect(id(page, `tips-${barber.name}`)).toContainText('AED 15.00');
  await id(page, `tips-pay-${barber.name}`).click();
  await id(page, 'tips-amount').fill('10');
  await id(page, 'tips-confirm').click();
  await expect(text(page, `Paid AED 10.00 tips to ${barber.name}`)).toBeVisible();
  await expect(id(page, `tips-${barber.name}`)).toContainText('AED 5.00');

  // Count with the notes helper: 2 × 100 + 1 × 50 + 1 × 10 = 260.00, i.e. short by 5.00.
  await id(page, 'closing-count-notes').click();
  await id(page, 'denom-10000').fill('2');
  await id(page, 'denom-5000').fill('1');
  await id(page, 'denom-1000').fill('1');
  await expect(id(page, 'denom-total')).toContainText('AED 260.00');
  await id(page, 'denom-done').click();
  // No difference before sending; the reason box is always there and the server says when a reason is needed.
  await expect(id(page, 'closing-variance')).toHaveCount(0);
  await id(page, 'closing-reason').fill('Change given twice');
  await id(page, 'closing-confirm').click();
  await snap(page, 'closing-count', mode);
  await id(page, 'closing-submit').click();
  await expect(text(page, 'Sent for approval')).toBeVisible();
  await expect(text(page, 'Pending approval').first()).toBeVisible();
  // Once sent, the difference shows: expected 200 opening + 50 + 25 cash sales − 10 tips = 265.00, counted 260.00.
  await expect(id(page, 'closing-variance')).toContainText('Short by AED 5.00');

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
  await expect(text(page, 'Sent for approval')).toBeVisible();

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
  // The title names the day the way people write it (E8): "Cash close · 15 Nov 2026".
  const closeDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${today}T00:00:00Z`));
  await expect(id(phone, 'journal-cash_close')).toContainText(`Cash close · ${closeDay}`);
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
  // The amount says what it is (E8).
  await expect(id(page, `closing-day-${today}`)).toContainText(/Difference\s*-AED\s5\.00/);
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
  await expect(id(phone, 'no-access')).toBeVisible();
});
