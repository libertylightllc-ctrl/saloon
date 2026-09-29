/** Remaining settings: customer receipt (off / simple / WhatsApp), backup ZIP, PIN quick-switch on a shared device. */
import { readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

import { createOwner, createStaff, sellService } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { id, ownerOn, signInStaff, snap, staffOn, tab, text } from './support/ui';

async function setReceiptMode(page: Page, mode: 'off' | 'simple' | 'whatsapp') {
  await page.goto('/settings/branch');
  await id(page, `branch-receipt-${mode}`).click();
  await id(page, 'branch-save').click();
  await expect(text(page, 'Settings saved')).toBeVisible();
}

async function sellOne(page: Page, service: string) {
  await page.goto('/sale');
  await id(page, `tile-${service}-add`).click();
  await id(page, 'checkout').click();
  await id(page, 'save-sale').click();
  await expect(id(page, 'sale-done')).toBeVisible();
}

test('the customer receipt follows the setting: none, printed, or sent on WhatsApp', async ({ page, mode }) => {
  const svc = SERVICE[mode];
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);

  await setReceiptMode(page, 'off');
  await sellOne(page, svc.name);
  await expect(id(page, 'share-receipt')).toHaveCount(0);
  await id(page, 'new-sale').click();

  await setReceiptMode(page, 'whatsapp');
  await sellOne(page, svc.name);
  // wa.me opens WhatsApp with the receipt filled in; the test answers for WhatsApp.
  await page.context().route(/^https:\/\/wa\.me\//, (route) => route.fulfill({ contentType: 'text/plain', body: 'WhatsApp' }));
  const [popup] = await Promise.all([page.waitForEvent('popup'), id(page, 'share-receipt').click()]);
  await popup.waitForLoadState();
  const url = new URL(popup.url());
  expect(url.hostname).toBe('wa.me');
  expect(url.searchParams.get('text')).toContain(svc.name);
  await popup.close();
  await id(page, 'new-sale').click();

  await setReceiptMode(page, 'simple');
  await sellOne(page, svc.name);
  await id(page, 'share-receipt').click();
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('iframe[data-receipt]') as HTMLIFrameElement | null)?.contentDocument?.body?.innerText ?? ''))
    .toContain(svc.name);
});

test('the owner downloads a backup: a ZIP with every table as CSV', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 20_000 });
  const sale = await sellService(owner.client, owner, SERVICE[mode].name, 'cash');
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-backup').click();
  const [file] = await Promise.all([page.waitForEvent('download'), id(page, 'backup-download').click()]);
  expect(file.suggestedFilename()).toMatch(/-backup-\d{4}-\d{2}-\d{2}\.zip$/);
  const zip = unzipSync(readFileSync((await file.path())!));
  for (const name of ['sales.csv', 'sale_lines.csv', 'journal_entries.csv', 'journal_lines.csv', 'customers.csv', 'employees.csv', 'audit_log.csv']) {
    expect(Object.keys(zip)).toContain(name);
  }
  const sales = strFromU8(zip['sales.csv']!);
  expect(sales).toContain(sale.sale_id);
  expect(strFromU8(zip['sale_lines.csv']!)).toContain(SERVICE[mode].name);
  await expect(text(page, /Backup ready/)).toBeVisible();
  await snap(page, 'backup', mode);
});

test('two people share the counter phone and switch with their PINs', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const cashier = await createStaff(owner, 'cashier', { name: 'Noor Counter' });
  const barber = await createStaff(owner, 'staff', { name: 'Rafiq Counter' });

  // The cashier signs in and sets a PIN; now the phone remembers them.
  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  await tab(page, 'more');
  await expect(id(page, 'more-switch')).toHaveCount(0);
  await id(page, 'more-pin').click();
  await id(page, 'pin-new').fill('1234');
  await id(page, 'pin-again').fill('1234');
  await id(page, 'pin-save').click();
  await expect(text(page, 'Use 4 digits that are not all the same or in a row.')).toBeVisible();
  await id(page, 'pin-new').fill('2468');
  await id(page, 'pin-again').fill('2468');
  await id(page, 'pin-save').click();
  await expect(text(page, 'PIN saved')).toBeVisible();

  // The barber signs in on the same phone without signing the cashier out, and sets a PIN too.
  await id(page, 'more-switch').click();
  await id(page, 'switch-login').fill(barber.username);
  await id(page, 'switch-password').fill(barber.password);
  await id(page, 'switch-add').click();
  await expect(text(page, /Rafiq Counter/).first()).toBeVisible();
  await tab(page, 'more');
  await expect(id(page, 'more-name')).toHaveText('Rafiq Counter');
  await id(page, 'more-pin').click();
  await id(page, 'pin-new').fill('1357');
  await id(page, 'pin-again').fill('1357');
  await id(page, 'pin-save').click();
  await expect(text(page, 'PIN saved')).toBeVisible();

  // Back to the cashier: a wrong PIN is refused, the right one switches.
  await id(page, 'more-switch').click();
  await id(page, 'switch-to-Noor Counter').click();
  await id(page, 'switch-pin').fill('1111');
  await id(page, 'switch-go').click();
  await expect(text(page, 'That PIN is not right.')).toBeVisible();
  await id(page, 'switch-pin').fill('2468');
  await id(page, 'switch-go').click();
  await expect(text(page, /Noor Counter/).first()).toBeVisible();
  await tab(page, 'more');
  await expect(id(page, 'more-name')).toHaveText('Noor Counter');
  await snap(page, 'pin-switch', mode);

  // And to the barber again; signing out forgets them on this phone.
  await id(page, 'more-switch').click();
  await id(page, 'switch-to-Rafiq Counter').click();
  await id(page, 'switch-pin').fill('1357');
  await id(page, 'switch-go').click();
  await expect(text(page, /Rafiq Counter/).first()).toBeVisible();
  await tab(page, 'more');
  await expect(id(page, 'more-name')).toHaveText('Rafiq Counter');
  await id(page, 'sign-out').click();
  await expect(id(page, 'sign-in-submit')).toBeVisible();
  await signInStaff(page, owner.code, cashier.username, cashier.password);
  await tab(page, 'more');
  await id(page, 'more-switch').click();
  await expect(id(page, 'switch-to-Rafiq Counter')).toHaveCount(0);
});
