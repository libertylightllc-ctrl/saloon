/** Notifications: a cashier's submitted close reaches the owner's bell and, through the every-minute push job,
 * the owner's phone (local push stand-in); a front-desk refund on a manager's PIN reaches the owner (brief B6). */
import { admin, createOwner, createStaff, sellCustom, staffEmail, userClient } from './support/api';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { id, ownerOn, staffOn, text } from './support/ui';

test('a submitted close rings the owner\'s bell and is pushed to the owner\'s phone', async ({ page, mode }) => {
  test.setTimeout(180_000);
  const owner = await createOwner(mode, { openingCash: 10_000 });
  const cashier = await createStaff(owner, 'cashier');
  const token = `ExponentPushToken[e2e-${uid()}]`;
  expect((await owner.client.rpc('register_push_token', { p_business: owner.businessId, p_token: token, p_platform: 'ios' })).error).toBeNull();

  const till = await userClient(staffEmail(owner.code, cashier.username), cashier.password);
  const { error } = await till.rpc('submit_cash_count', {
    p: { branch_id: owner.branchId, counted_cash_minor: 9_500, submit: true, drawer_closed_confirmed: true, reason: 'Short change' },
  });
  expect(error).toBeNull();

  await ownerOn(page, mode, owner.email, owner.password);
  await expect(id(page, 'home-bell')).toContainText('1');
  await id(page, 'home-bell').click();
  const row = id(page, 'notification-close_submitted');
  await expect(row).toContainText('Cash close waiting for approval');
  await expect(row).toContainText('-AED 5.00');
  await id(page, 'notifications-read-all').click();
  await expect(text(page, '1 marked as read')).toBeVisible();
  await expect(id(page, 'notifications-read-all')).toHaveAttribute('aria-disabled', 'true'); // nothing left to mark
  await row.click();
  await expect(id(page, 'closing-approve')).toBeVisible();
  await page.goto('/');
  await expect(id(page, 'home-bell')).not.toContainText('1');

  // The every-minute job hands it to send-push, which delivers it to the owner's phone.
  await expect
    .poll(
      async () => {
        const { data } = await admin.from('push_deliveries').select('status, title, body').eq('token', token);
        return data?.[0] ?? null;
      },
      { timeout: 120_000, intervals: [5_000] },
    )
    .toMatchObject({ status: 'ok', title: 'Cash close waiting for approval' });
});

test('the front desk refunds on a manager’s PIN; the owner is told and opens the sale', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const desk = await createStaff(owner, 'cashier');
  const manager = await createStaff(owner, 'cashier', { name: 'Mona Manager' });
  const promoted = await owner.client.rpc('set_login_type', { p_member: manager.memberId, p_role: 'manager' });
  if (promoted.error) throw promoted.error;
  const managerApi = await userClient(staffEmail(owner.code, manager.username), manager.password);
  const pin = await managerApi.rpc('set_my_pin', { p_business: owner.businessId, p_pin: '1357' });
  if (pin.error) throw pin.error;
  const sale = await sellCustom(owner.client, owner, { card: 8_000 });

  await staffOn(page, mode, owner.code, desk.username, desk.password);
  await page.goto(`/sales/${sale.sale_id}`);
  await id(page, 'sale-refund').click();
  await id(page, 'refund-amount').fill('30');
  await id(page, 'refund-reason').fill('Colour not as agreed');
  await id(page, 'refund-method-card').click();
  await id(page, 'refund-confirm').click();
  await id(page, 'approver-Mona Manager').click();
  await id(page, 'approval-pin').fill('1357');
  await id(page, 'approval-approve').click();
  await expect(text(page, 'Refunded AED 30.00')).toBeVisible();

  const phone = await device();
  await ownerOn(phone, mode, owner.email, owner.password);
  await id(phone, 'home-bell').click();
  const row = id(phone, 'notification-refund_made');
  await expect(row).toContainText('Refund AED 30.00');
  await expect(row).toContainText(`${desk.name} · approved by Mona Manager · Reason: Colour not as agreed`);
  await row.click();
  await expect(id(phone, 'sale-total')).toBeVisible();
  await expect(text(phone, 'Colour not as agreed')).toBeVisible();
});
