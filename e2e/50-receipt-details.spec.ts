/**
 * What a receipt says about the seller (owner, 2026-10-19): the registered company name and the licence / CR number
 * set in Branch settings print under the tax number, and a Saudi tax invoice carries ZATCA's QR code (seller, VAT
 * number, time, total, VAT).
 */
import type { Page } from '@playwright/test';

import { admin, createOwner, latestSale, SAUDI, type Mode } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { field, id, ownerOn, tab } from './support/ui';

async function sellAndPrint(page: Page, mode: Mode, branchId: string) {
  await tab(page, 'sale');
  await id(page, `tile-${SERVICE[mode].name}-add`).click();
  await id(page, 'checkout').click();
  await id(page, 'save-sale').click();
  await expect(id(page, 'sale-done')).toBeVisible();
  const sale = await latestSale(branchId);
  await page.goto('/sales');
  await id(page, `sale-row-${sale.number}`).click();
  await page.getByRole('button', { name: 'Print receipt' }).click();
  return sale;
}

const receiptText = (page: Page) =>
  page.evaluate(() => (document.querySelector('iframe[data-receipt]') as HTMLIFrameElement | null)?.contentDocument?.body?.innerText ?? '');

test('the company name and trade licence number print on the tax invoice', async ({ page, mode }) => {
  const owner = await createOwner(mode, { vat: true });
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-branch').click();
  await expect(id(page, 'seller-fields')).toBeVisible();
  // The UAE calls it a trade licence; the owner can rename it.
  await expect(field(page, 'licence_label')).toHaveValue('Trade licence no.');
  await field(page, 'legal_name').fill('Al Barsha Gents Salon LLC');
  await field(page, 'licence_number').fill('CR#1');
  await id(page, 'branch-save').click();
  await expect(id(page, 'branch-save')).toBeVisible();
  await expect(page.getByText('Letters, numbers and . / - only')).toBeVisible();
  await field(page, 'licence_number').fill('1234567');
  await id(page, 'branch-save').click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  const { data: branch } = await admin.from('branches').select('legal_name, licence_label, licence_number').eq('id', owner.branchId).single();
  expect(branch).toEqual({ legal_name: 'Al Barsha Gents Salon LLC', licence_label: 'Trade licence no.', licence_number: '1234567' });

  await page.goto('/');
  await sellAndPrint(page, mode, owner.branchId);
  await expect.poll(() => receiptText(page)).toContain('Al Barsha Gents Salon LLC');
  await expect.poll(() => receiptText(page)).toContain('Trade licence no. 1234567');
  await expect.poll(() => receiptText(page)).toContain('100234567800003');
});

test('a Saudi tax invoice carries ZATCA’s QR code with the seller, VAT number, time, total and VAT', async ({ page, mode }) => {
  const owner = await createOwner(mode, { vat: true, country: SAUDI });
  const { data: biz } = await admin.from('businesses').select('name').eq('id', owner.businessId).single();
  await ownerOn(page, mode, owner.email, owner.password);
  const sale = await sellAndPrint(page, mode, owner.branchId);
  const qr = () =>
    page.evaluate(() => {
      const doc = (document.querySelector('iframe[data-receipt]') as HTMLIFrameElement | null)?.contentDocument;
      const box = doc?.querySelector('.qr[data-zatca]');
      return box ? { text: box.getAttribute('data-zatca') ?? '', svg: Boolean(box.querySelector('svg')) } : null;
    });
  await expect.poll(qr).not.toBeNull();
  const { text, svg } = (await qr())!;
  expect(svg).toBe(true);
  // Tag · length · value, five times (ZATCA phase 1).
  const bytes = Buffer.from(text, 'base64');
  const fields: string[] = [];
  for (let i = 0; i < bytes.length; ) {
    const length = bytes[i + 1]!;
    fields.push(bytes.subarray(i + 2, i + 2 + length).toString('utf8'));
    i += 2 + length;
  }
  expect(fields).toEqual([
    biz!.name,
    '310122393500003',
    new Date(sale.created_at).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    (sale.total_minor / 100).toFixed(2),
    (sale.vat_minor / 100).toFixed(2),
  ]);
  expect(sale.vat_minor).toBeGreaterThan(0);
});
