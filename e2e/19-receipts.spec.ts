/** Receipt photos: the owner snaps one while recording an expense; a cashier adds one to a bill later.
 * The photo lands in the private bucket, shows on the record, and opens full size. */
import type { Page } from '@playwright/test';
import path from 'path';

import { admin, createOwner, createStaff, staffEmail, userClient } from './support/api';
import { expect, test } from './support/fixtures';
import { id, idStarts, ownerOn, snap, staffOn, tab, text } from './support/ui';

const PHOTO = path.join(__dirname, 'fixtures', 'receipt.jpg');

async function choosePhoto(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  await id(page, 'receipt-choose').click();
  await (await chooser).setFiles(PHOTO);
}

/** The photo really loaded (not a broken link). */
async function expectPhotoShown(page: Page) {
  await expect(id(page, 'receipt-photo')).toBeVisible();
  await expect
    .poll(() => id(page, 'receipt-photo').locator('img').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
}

test('owner adds a receipt photo while recording an expense; it shows on the expense', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 10_000 });
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-expenses').click();
  await id(page, 'expenses-new').click();
  await id(page, 'expense-amount').fill('45');
  await id(page, 'expense-category-dry_cleaning').click();
  await id(page, 'expense-method-cash').click();
  await choosePhoto(page);
  await expect(id(page, 'receipt-preview')).toBeVisible();
  await id(page, 'expense-save').click();
  await expect(text(page, 'Expense saved')).toBeVisible();

  const { data: row } = await admin.from('expenses').select('id, receipt_path').eq('business_id', owner.businessId).single();
  expect(row!.receipt_path).toMatch(new RegExp(`^${owner.businessId}/expenses/${row!.id}-`));
  const { data: file } = await admin.storage.from('receipts').download(row!.receipt_path!);
  expect(file!.size).toBeGreaterThan(1000);

  await idStarts(page, 'expense-dry_cleaning').first().click();
  await expectPhotoShown(page);
  await snap(page, 'expense-receipt', mode);
  await id(page, 'receipt-photo').click();
  await expect(id(page, 'receipt-full')).toBeVisible();
  await expect(id(page, 'receipt-choose')).toHaveCount(0); // one photo per record, never replaced
});

test('a cashier adds a photo to their bill afterwards; staff never reach receipts', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const cashier = await createStaff(owner, 'cashier');
  const staff = await createStaff(owner, 'staff');
  const till = await userClient(staffEmail(owner.code, cashier.username), cashier.password);
  const { data: supplierId } = await till.rpc('save_supplier', { p: { business_id: owner.businessId, name: 'Receipt Supplies', terms_days: 15 } });
  const { data: bill, error } = await till.rpc('post_purchase_bill', {
    p: { branch_id: owner.branchId, supplier_id: supplierId, lines: [{ description: 'Towels', qty: 10, unit_cost_minor: 800 }] },
  });
  expect(error).toBeNull();

  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  await page.goto(`/purchases/${(bill as { bill_id: string }).bill_id}`);
  await expect(text(page, 'No photo yet.', false)).toBeVisible();
  await choosePhoto(page);
  await expect(text(page, 'Receipt photo added')).toBeVisible();
  await expectPhotoShown(page);

  // The cashier cannot delete it through the storage API either: it is still there afterwards.
  const { data: billRow } = await admin.from('purchase_bills').select('receipt_path').eq('id', (bill as { bill_id: string }).bill_id).single();
  await till.storage.from('receipts').remove([billRow!.receipt_path!]);
  const { data: still } = await admin.storage.from('receipts').download(billRow!.receipt_path!);
  expect(still!.size).toBeGreaterThan(1000);

  const phone = await device();
  await staffOn(phone, mode, owner.code, staff.username, staff.password);
  const staffApi = await userClient(staffEmail(owner.code, staff.username), staff.password);
  const { data: files } = await staffApi.storage.from('receipts').list(`${owner.businessId}/bills`);
  expect(files ?? []).toHaveLength(0);
  await phone.goto(`/purchases/${(bill as { bill_id: string }).bill_id}`);
  await expect(id(phone, 'tab-index')).toHaveAttribute('aria-selected', 'true');
});
