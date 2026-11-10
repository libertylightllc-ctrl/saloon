/** Deliveries (brief B2 "Order stock, receive a delivery"): the front desk records what arrived, with a photo of the
 * delivery note and no prices; nothing goes into stock. A manager adds the prices from the invoice, which makes the
 * supplier bill and puts it in stock. A waiting delivery is cancelled with a reason, never deleted. */
import type { Page } from '@playwright/test';
import path from 'path';

import { createOwner, createStaff, stockQty, type Owner } from './support/api';
import { expect, test } from './support/fixtures';
import { back, id, snap, staffOn, tab, text } from './support/ui';

const PHOTO = path.join(__dirname, 'fixtures', 'receipt.jpg');

async function choosePhoto(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  await id(page, 'receipt-choose').click();
  await (await chooser).setFiles(PHOTO);
}

/** The item's stock in the branch; 0 before anything was ever put in (no stock row yet). */
const wax = (owner: Owner) =>
  stockQty(owner.branchId, owner.businessId, 'Wax strips').catch((e: { code?: string }) => {
    if (e.code === 'PGRST116') return 0;
    throw e;
  });

async function salonWithStock(mode: 'gents' | 'ladies'): Promise<Owner> {
  const owner = await createOwner(mode);
  const item = await owner.client.rpc('save_item', {
    p: { business_id: owner.businessId, name: 'Wax strips', kind: 'consumable', unit: 'pcs', reorder_level: 0 },
  });
  if (item.error) throw item.error;
  const supplier = await owner.client.rpc('save_supplier', { p: { business_id: owner.businessId, name: 'Gulf Beauty Supply', terms_days: 30 } });
  if (supplier.error) throw supplier.error;
  return owner;
}

/** The front desk: More → Stock → Receive a delivery, 3 packs of 20 with a photo of the note. */
async function receive(page: Page, mode: 'gents' | 'ladies') {
  await tab(page, 'more');
  await id(page, 'more-inventory').click();
  await id(page, 'inventory-receive').click();
  await id(page, 'delivery-supplier-Gulf Beauty Supply').click();
  await id(page, 'delivery-item-Wax strips').click();
  await id(page, 'delivery-line-packs-0').fill('3');
  await id(page, 'delivery-line-pack-0').fill('20');
  await expect(text(page, 'Adds 60 pc to stock once priced')).toBeVisible();
  await expect(id(page, 'delivery-save')).toBeDisabled(); // the front desk always gives a photo of the note
  await choosePhoto(page);
  await expect(id(page, 'receipt-preview')).toBeVisible();
  await snap(page, 'delivery-receive', mode);
  await id(page, 'delivery-save').click();
  await expect(text(page, 'Delivery 1 saved, waiting for prices')).toBeVisible();
}

test('the front desk receives a delivery; a manager prices it into a bill and the stock goes up', async ({ page, mode, device }) => {
  const owner = await salonWithStock(mode);
  const desk = await createStaff(owner, 'cashier');
  const manager = await createStaff(owner, 'cashier', { name: 'Mona Manager' });
  const promoted = await owner.client.rpc('set_login_type', { p_member: manager.memberId, p_role: 'manager' });
  if (promoted.error) throw promoted.error;

  await staffOn(page, mode, owner.code, desk.username, desk.password);
  await receive(page, mode);
  await expect(text(page, 'Waiting for the owner, a manager or the accountant to add the prices.')).toBeVisible();
  await expect(id(page, 'receipt-photo')).toBeVisible();
  await expect(id(page, 'price-save')).toHaveCount(0); // the front desk adds no prices
  expect(await wax(owner)).toBe(0);

  // The manager sees it on Home and adds the prices from the invoice: 3 × AED 45.00 + 5% VAT.
  const other = await device('manager');
  await staffOn(other, mode, owner.code, manager.username, manager.password);
  await expect(id(other, 'attention-deliveries-waiting')).toContainText('A delivery is waiting for prices');
  await id(other, 'attention-deliveries-waiting-action').click();
  await expect(id(other, 'price-supplier-Gulf Beauty Supply')).toHaveAttribute('aria-selected', 'true');
  await id(other, 'price-invoice').fill('GBS-1001');
  await id(other, 'price-line-price-0').fill('45');
  await expect(id(other, 'price-total')).toContainText('141.75');
  await snap(other, 'delivery-price', mode);
  await id(other, 'price-save').click();
  await expect(text(other, 'Delivery priced: bill PUR-00001')).toBeVisible();
  await expect(text(other, 'GBS-1001')).toBeVisible();
  await expect.poll(() => wax(owner)).toBe(60);

  // Back on the front desk's phone the delivery now says Priced.
  await back(page);
  await id(page, 'inventory-deliveries').click();
  await expect(id(page, 'delivery-1')).toContainText('Priced');
});

test('the front desk cancels a delivery entered by mistake, with a reason', async ({ page, mode }) => {
  const owner = await salonWithStock(mode);
  const desk = await createStaff(owner, 'cashier');
  await staffOn(page, mode, owner.code, desk.username, desk.password);
  await receive(page, mode);
  await id(page, 'delivery-cancel').click();
  await expect(id(page, 'delivery-cancel-confirm')).toBeDisabled();
  await id(page, 'delivery-cancel-text').fill('Wrong salon, sent back');
  await id(page, 'delivery-cancel-confirm').click();
  await expect(text(page, 'Delivery 1 cancelled')).toBeVisible();
  await expect(id(page, 'delivery-cancel-reason')).toContainText('Wrong salon, sent back');
  await expect(id(page, 'delivery-cancel')).toHaveCount(0);
  expect(await wax(owner)).toBe(0);
});
