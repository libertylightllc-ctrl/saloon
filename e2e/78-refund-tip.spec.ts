/** Owner's fix list, 16 Nov 2026 (item 3): a refund comes out of the services and products, never the stylist's tip,
 * unless "Also refund the tip" is ticked. A QAR/AED 40 blow dry with a 5 tip, refunded in two steps from the app. */
import { admin, createOwner, createStaff, employeeOf } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, tab, text } from './support/ui';

test('a refund leaves the tip alone unless "Also refund the tip" is ticked', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 10_000 });
  const stylist = await createStaff(owner, 'staff', { commissionBps: 3500 });
  const emp = await employeeOf(stylist.memberId);
  const { data: sale, error } = await owner.client.rpc('create_sale', {
    p: {
      branch_id: owner.branchId,
      client_ref: crypto.randomUUID(),
      employee_id: emp,
      tip_minor: 500,
      tip_employee_id: emp,
      lines: [{ kind: 'custom', name: 'Blow dry', unit_price_minor: 4000, employee_id: emp }],
      payments: [{ method: 'cash', amount_minor: 4500 }],
    },
  });
  if (error) throw error;
  const { sale_id, number } = sale as { sale_id: string; number: number };
  const refundTips = async () => {
    const { data } = await admin.from('refunds').select('amount_minor, tip_minor').eq('sale_id', sale_id).order('created_at');
    return data ?? [];
  };

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-sales').click();
  await id(page, `sale-row-${number}`).click();

  // 1. Not ticked: up to the 40.00 of services; 10.00 comes out of them and the tip stays whole.
  await id(page, 'sale-refund').click();
  await expect(text(page, 'Up to AED 40.00 can be refunded.')).toBeVisible();
  // "Also refund the tip" is there and off (the amount above is the services only).
  await expect(id(page, 'refund-tip')).toBeVisible();
  await id(page, 'refund-amount').fill('10.00');
  await id(page, 'refund-reason').fill('Fringe too short');
  await id(page, 'refund-confirm').click();
  await expect(text(page, 'Refunded AED 10.00')).toBeVisible();
  expect(await refundTips()).toEqual([{ amount_minor: 1000, tip_minor: 0 }]);

  // 2. Still not ticked: no more than the 30.00 of services left; more is refused on the sheet.
  await id(page, 'sale-refund').click();
  await expect(text(page, 'Up to AED 30.00 can be refunded.')).toBeVisible();
  await id(page, 'refund-amount').fill('35.00');
  await id(page, 'refund-reason').fill('Whole visit back');
  await expect(id(page, 'refund-confirm')).toHaveAttribute('aria-disabled', 'true');

  // 3. Ticked: the tip can go back too, and this refund takes it.
  await id(page, 'refund-tip').click();
  await expect(text(page, 'Up to AED 35.00 can be refunded.')).toBeVisible();
  await id(page, 'refund-confirm').click();
  await expect(text(page, 'Refunded AED 35.00')).toBeVisible();
  expect(await refundTips()).toEqual([
    { amount_minor: 1000, tip_minor: 0 },
    { amount_minor: 3500, tip_minor: 500 },
  ]);
  const { data: row } = await admin.from('sales').select('status, refunded_minor').eq('id', sale_id).single();
  expect(row).toEqual({ status: 'refunded', refunded_minor: 4500 });
});
