/**
 * The salon's logo on its receipts (owner, 2026-10-19: "the easiest way to add the salon logo in the receipt — JPG or
 * PNG?" → PNG, "yes"). The owner picks a picture in Branch settings; it is shrunk to receipt size and kept as PNG (the
 * see-through background stays); it prints at the top of every receipt and shows on the receipt link page.
 */
import type { Page } from '@playwright/test';
import path from 'path';

import { admin, createOwner, latestSale, type Mode } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap, tab, text } from './support/ui';

/** 1200 × 400, a violet circle and a bar on a see-through background. */
const LOGO = path.join(__dirname, 'fixtures', 'logo.png');

/** The printout's logo: its data: link's start and its drawn size, or null. */
const printedLogo = (page: Page) =>
  page.evaluate(() => {
    const img = document.querySelector('[data-printout]')?.shadowRoot?.querySelector('img.logo') as HTMLImageElement | null;
    return img ? { src: img.src.slice(0, 22), width: img.naturalWidth, height: img.naturalHeight, drawn: img.complete } : null;
  });

async function sellAndPrint(page: Page, mode: Mode, branchId: string) {
  await page.goto('/');
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

test('the owner adds a PNG logo: shrunk to receipt size, printed at the top, on the receipt link too', async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { vat: true });
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-branch').click();
  await expect(id(page, 'logo-field')).toContainText('A PNG with a see-through background looks best.');
  await expect(id(page, 'logo-preview')).toHaveCount(0);
  const chooser = page.waitForEvent('filechooser');
  await id(page, 'logo-add').click();
  await (await chooser).setFiles(LOGO);
  await expect(text(page, 'Logo added to receipts')).toBeVisible();
  await expect(id(page, 'logo-preview')).toBeVisible();
  await expect(id(page, 'logo-add')).toContainText('Change logo');
  await snap(page, 'logo-field', mode);

  // Stored as a PNG of 600 × 200 in the salon's folder.
  const { data: branch } = await admin.from('branches').select('logo_path').eq('id', owner.branchId).single();
  expect(branch!.logo_path).toMatch(new RegExp(`^${owner.businessId}/${owner.branchId}-[0-9a-f]{8}\\.png$`));
  const stored = Buffer.from(await (await fetch(admin.storage.from('logos').getPublicUrl(branch!.logo_path!).data.publicUrl)).arrayBuffer());
  expect(stored.subarray(1, 4).toString()).toBe('PNG');
  expect([stored.readUInt32BE(16), stored.readUInt32BE(20)]).toEqual([600, 200]);
  expect(stored[25]).toBe(6); // colour with a see-through channel

  // On the printed receipt, above the salon's name, drawn before printing.
  const sale = await sellAndPrint(page, mode, owner.branchId);
  await expect.poll(() => printedLogo(page)).toEqual({ src: 'data:image/png;base64,', width: 600, height: 200, drawn: true });
  await page.emulateMedia({ media: 'print' });
  await snap(page, 'receipt-80mm-logo', mode);
  await page.emulateMedia({ media: 'screen' });

  // On the receipt link the customer opens from WhatsApp.
  const { data: token } = await admin.from('sales').select('receipt_token').eq('id', sale.id).single();
  const customer = await device();
  await customer.goto(`/r/${token!.receipt_token}`);
  const frame = customer.frameLocator('iframe[data-receipt-view]');
  await expect(frame.locator('img.logo')).toBeVisible();
  expect(await frame.locator('img.logo').getAttribute('src')).toMatch(/^data:image\/png;base64,/);

  // Taken off: receipts print without it.
  await page.goto('/settings/branch');
  await id(page, 'logo-remove').click();
  await expect(text(page, 'Logo removed from receipts')).toBeVisible();
  await expect(id(page, 'logo-preview')).toHaveCount(0);
  await sellAndPrint(page, mode, owner.branchId);
  await expect.poll(async () => (await page.evaluate(() => Boolean(document.querySelector('[data-printout]'))))).toBe(true);
  expect(await printedLogo(page)).toBeNull();
});

/** The printout on paper: its paper, its width in mm, and the page rules lifted to the page. */
async function onPaper(page: Page) {
  await page.emulateMedia({ media: 'print' });
  const result = await page.evaluate(() => {
    const box = document.querySelector('[data-printout]')?.shadowRoot?.querySelector('.printout') as HTMLElement | null;
    return {
      paper: box?.dataset.paper ?? null,
      mm: box ? Math.round((box.getBoundingClientRect().width * 25.4) / 96) : 0,
      pageRules: document.getElementById('printout-page')?.textContent ?? '',
    };
  });
  await page.emulateMedia({ media: 'screen' });
  return result;
}

async function pickPaper(page: Page, paper: '80mm' | '58mm' | 'a4') {
  await page.goto('/settings/branch');
  await id(page, `branch-paper-${paper}`).click();
  await id(page, 'branch-save').click();
  await expect(text(page, 'Settings saved')).toBeVisible();
}

test('receipts print for the paper picked: the 80 mm roll by default, 58 mm, or A4', async ({ page, mode }) => {
  const owner = await createOwner(mode, { vat: true });
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-branch').click();
  await expect(id(page, 'branch-paper-80mm')).toHaveAttribute('aria-selected', 'true');

  // An 80 mm roll prints 72 mm wide (the printer's edges), with no page margin.
  await sellAndPrint(page, mode, owner.branchId);
  await expect.poll(() => onPaper(page)).toMatchObject({ paper: '80mm', mm: 72 });
  expect((await onPaper(page)).pageRules).toContain('@page { margin: 0; }');

  await pickPaper(page, '58mm');
  expect(((await admin.from('branches').select('settings').eq('id', owner.branchId).single()).data!.settings as { receipt_paper: string }).receipt_paper).toBe('58mm');
  await sellAndPrint(page, mode, owner.branchId);
  await expect.poll(() => onPaper(page)).toMatchObject({ paper: '58mm', mm: 48 });

  // A4: the page as before, no roll rules left over.
  await pickPaper(page, 'a4');
  await sellAndPrint(page, mode, owner.branchId);
  await expect.poll(() => onPaper(page)).toMatchObject({ paper: 'a4', pageRules: '' });
});
