/** Compliance: the register fills from the template, a licence with its scan is valid, a staff health card is
 * renewed as version 2, the cashier signs the hygiene log, the binder exports, Montaji numbers are added,
 * readiness moves and Home asks for what is missing. */
import type { Page } from '@playwright/test';
import path from 'path';

import { createOwner, createStaff, dubaiDate } from './support/api';
import { expect, test } from './support/fixtures';
import { back, id, ownerOn, staffOn, tab, text } from './support/ui';

const PHOTO = path.join(__dirname, 'fixtures', 'receipt.jpg');

async function choosePhoto(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  await id(page, 'receipt-choose').click();
  await (await chooser).setFiles(PHOTO);
}

test('owner keeps the register: licence, a renewed health card, Montaji, binder; readiness rises', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const barber = await createStaff(owner, 'staff');
  const branch = `E2E ${mode} branch`;
  await ownerOn(page, mode, owner.email, owner.password);
  await expect(id(page, 'attention-compliance')).toBeVisible();
  await tab(page, 'more');
  await id(page, 'more-compliance').click();
  await expect(id(page, 'compliance-readiness-value')).toHaveText('0%');

  // Trade licence with its scan → valid.
  await id(page, `doc-trade_licence-${branch}`).click();
  await id(page, 'doc-edit').click();
  await id(page, 'doc-number').fill('CN-1234567');
  await id(page, 'doc-issued').fill(dubaiDate(-300));
  await id(page, 'doc-expires').fill(dubaiDate(65));
  await id(page, 'doc-cost').fill('15000');
  await choosePhoto(page);
  await id(page, 'doc-save').click();
  await expect(text(page, 'Saved', true)).toBeVisible();
  await expect(id(page, 'doc-detail-number')).toHaveText('CN-1234567');
  await expect(text(page, 'Valid', true).first()).toBeVisible();
  await expect(id(page, 'doc-evidence')).toBeVisible();
  await back(page);
  await expect(id(page, `doc-trade_licence-${branch}`)).toContainText('Valid');
  await expect(id(page, 'compliance-readiness-value')).toHaveText('14%'); // 1 of 7 (4 salon + 3 for the barber)

  // The barber's health card: due soon, then renewed → version 2, needs its own scan.
  await id(page, `doc-health_card-${barber.name}`).click();
  await id(page, 'doc-edit').click();
  await id(page, 'doc-number').fill('HC-55');
  await id(page, 'doc-expires').fill(dubaiDate(10));
  await choosePhoto(page);
  await id(page, 'doc-save').click();
  await expect(text(page, 'Due soon', true).first()).toBeVisible();
  await id(page, 'doc-edit').click();
  await expect(text(page, 'Renewing keeps the old version in the history.')).toBeVisible();
  await id(page, 'doc-number').fill('HC-56');
  await id(page, 'doc-expires').fill(dubaiDate(375));
  await id(page, 'doc-save').click();
  await expect(text(page, 'Renewed', true)).toBeVisible();
  await expect(id(page, 'doc-detail-version')).toHaveText('2');
  await expect(id(page, 'doc-version-1')).toBeVisible();
  await expect(text(page, 'Scan missing', true).first()).toBeVisible();
  await choosePhoto(page);
  await expect(text(page, 'Scan added')).toBeVisible();
  await expect(text(page, 'Valid', true).first()).toBeVisible();
  await back(page);
  await expect(id(page, 'compliance-readiness-value')).toHaveText('29%'); // 2 of 7

  // Montaji: add the number for a product used in services.
  await id(page, 'compliance-tab-wps').click();
  const product = page.locator('[data-testid^="montaji-"]').filter({ visible: true }).first();
  await expect(product).toContainText('No Montaji number');
  await product.click();
  await id(page, 'item-montaji').fill('MNT-2026-0042');
  await id(page, 'item-save').click();
  await expect(text(page, 'Item saved')).toBeVisible();
  await expect(page.locator('[data-testid^="montaji-"]').filter({ hasText: 'MNT-2026-0042' })).toContainText('Registered');

  // The binder exports as a PDF (printed from a frame on the web).
  await id(page, 'compliance-tab-binder').click();
  await expect(id(page, `binder-trade_licence-${branch}`)).toContainText('Valid');
  await id(page, 'binder-export').click();
  await expect.poll(() => page.evaluate(() => document.querySelector('iframe[data-receipt]')?.getAttribute('data-receipt'))).toBe('true');
  const pdf = await page.evaluate(() => (document.querySelector('iframe[data-receipt]') as HTMLIFrameElement).contentDocument!.body.innerText);
  expect(pdf).toContain('Inspection binder');
  expect(pdf).toContain('CN-1234567');
  expect(pdf).toContain('MNT-2026-0042');
});

test('the cashier signs the hygiene log; staff never reach compliance', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const cashier = await createStaff(owner, 'cashier');
  const barber = await createStaff(owner, 'staff');

  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  await expect(id(page, 'attention-hygiene')).toBeVisible();
  await tab(page, 'more');
  await id(page, 'more-compliance').click();
  await expect(id(page, 'compliance-tab-register')).toHaveCount(0); // only the hygiene log
  for (const item of ['tools_sterilised', 'towels_changed', 'surfaces_cleaned', 'waste_disposed']) await id(page, `hygiene-${item}`).click();
  await id(page, 'hygiene-note').fill('Mop head broken');
  await id(page, 'hygiene-sign').click();
  await expect(text(page, 'Hygiene log signed')).toBeVisible();
  await expect(id(page, 'hygiene-today')).toContainText('4 of 5 done today');
  await expect(id(page, `hygiene-${dubaiDate()}`)).toContainText('4/5');
  await page.goto('/compliance/doc?type=trade_licence');
  await expect(id(page, 'tab-index')).toHaveAttribute('aria-selected', 'true');
  await expect(id(page, 'attention-hygiene')).toHaveCount(0);

  const phone = await device();
  await staffOn(phone, mode, owner.code, barber.username, barber.password);
  await tab(phone, 'more');
  await expect(id(phone, 'more-compliance')).toHaveCount(0);
  await phone.goto('/compliance');
  await expect(id(phone, 'tab-index')).toHaveAttribute('aria-selected', 'true');
});
