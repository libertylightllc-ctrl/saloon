/** Notifications: a cashier's submitted close reaches the owner's bell and, through the every-minute push job,
 * the owner's phone (local push stand-in); a cashier's refund request reaches the owner, who refunds it. */
import { admin, createOwner, createStaff, sellCustom, staffEmail, userClient } from './support/api';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { id, ownerOn, staffOn, tab, text } from './support/ui';

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

test('a cashier asks for a refund; the owner is told, opens the sale and refunds it', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const cashier = await createStaff(owner, 'cashier');
  const sale = await sellCustom(owner.client, owner, { card: 8_000 });

  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  await page.goto(`/sales/${sale.sale_id}`);
  await expect(id(page, 'sale-refund')).toHaveCount(0);
  await id(page, 'refund-request-ask').click();
  await id(page, 'refund-request-amount').fill('30');
  await id(page, 'refund-request-reason').fill('Colour not as agreed');
  await id(page, 'refund-request-send').click();
  await expect(text(page, 'Request sent to the owner')).toBeVisible();
  await expect(id(page, 'refund-request')).toContainText('Colour not as agreed');
  await expect(id(page, 'refund-request-ask')).toHaveCount(0);

  const phone = await device();
  await ownerOn(phone, mode, owner.email, owner.password);
  await id(phone, 'home-bell').click();
  await expect(id(phone, 'notification-refund_requested')).toContainText(`Sale #${sale.number} · AED 30.00`);
  await id(phone, 'notification-refund_requested').click();
  await expect(id(phone, 'refund-request')).toContainText('asked for AED 30.00');
  await id(phone, 'sale-refund').click();
  await id(phone, 'refund-amount').fill('30');
  await id(phone, 'refund-reason').fill('Colour not as agreed');
  await id(phone, 'refund-confirm').click();
  await expect(text(phone, 'Refunded AED 30.00')).toBeVisible();
  await expect(id(phone, 'refund-request')).toHaveCount(0);
  await expect(id(page, 'refund-request')).toHaveCount(0); // the cashier's screen follows live
});
