/**
 * How salons pay (owner, 2026-10-04): the platform owner sets where to pay (bank transfer and a card payment link);
 * a salon owner sees it on the Plan page with their salon code as the reference, asks for the plan, and the platform
 * owner is emailed (locally the email goes to the mail-sink stand-in instead of Resend).
 */
import { admin, createOwner, makePlatformAdmin } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap, tab, text } from './support/ui';

test('the platform owner sets where to pay; a salon owner sees it, asks for the plan, and the platform owner is emailed', async ({
  page,
  mode,
  device,
}) => {
  const platform = await createOwner(mode);
  await makePlatformAdmin(platform.email);
  const owner = await createOwner(mode, { plan: false });

  // The platform owner: Admin → Payment details. A wrong IBAN is refused with a clear message.
  await ownerOn(page, mode, platform.email, platform.password);
  await tab(page, 'more');
  await id(page, 'more-admin').click();
  await id(page, 'admin-pay').click();
  await id(page, 'admin-pay-bank_name').fill('Emirates NBD');
  await id(page, 'admin-pay-bank_account_name').fill('Saloqo FZ-LLC');
  await id(page, 'admin-pay-bank_iban').fill('12 34');
  await id(page, 'admin-pay-save').click();
  await expect(id(page, 'form-error')).toContainText('That IBAN does not look right');
  await id(page, 'admin-pay-bank_iban').fill('ae07 0331 2345 6789 0123 456');
  await id(page, 'admin-pay-bank_swift').fill('EBILAEAD');
  await id(page, 'admin-pay-pay_link_url').fill('https://buy.stripe.com/test_saloqo');
  await id(page, 'admin-pay-save').click();
  await expect(text(page, 'Payment details saved')).toBeVisible();

  // The salon owner: Plan shows how to pay, with their salon code as the reference.
  const shop = await device();
  await ownerOn(shop, mode, owner.email, owner.password);
  await shop.goto('/plan');
  await expect(id(shop, 'plan-pay-iban')).toHaveText('AE07 0331 2345 6789 0123 456'); // in groups of four
  await expect(id(shop, 'plan-pay-account')).toHaveText('Saloqo FZ-LLC');
  await expect(id(shop, 'plan-pay-reference')).toHaveText(owner.code);
  const popup = shop.context().waitForEvent('page');
  await id(shop, 'plan-pay-link').click();
  await expect.poll(async () => (await popup).url()).toContain('buy.stripe.com/test_saloqo');
  await snap(shop, 'plan-how-to-pay', mode);

  // They ask for a month; the platform owner is emailed about it.
  await id(shop, 'plan-request').click();
  await expect(id(shop, 'plan-requested')).toContainText('1 month');
  await expect
    .poll(
      async () => {
        const { data } = await admin.from('plan_events').select('alerted_at').eq('business_id', owner.businessId).eq('kind', 'request').single();
        return data?.alerted_at ?? null;
      },
      { timeout: 60_000 },
    )
    .not.toBeNull();
});
