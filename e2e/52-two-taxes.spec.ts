/**
 * Canada (owner, 2026-10-19: "gst and hst will be together or both are different" → "go for both"): the province
 * fills in its tax (HST alone, or GST with a provincial tax beside it); a second tax is charged with the first and
 * shown on its own line at checkout, on the sale and on the receipt, and kept apart in the books.
 */
import type { Page } from '@playwright/test';

import { admin, createOwner, latestSale, type Country, type Mode } from './support/api';
import { SERVICE } from './support/catalog';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { chooseType, field, id, ownerOn, printedText, snap, tab, text } from './support/ui';

/** A Canadian salon set up before provinces were asked: the country's GST/HST 5%, added at the till. */
const CANADA: Country = {
  country_code: 'CA',
  currency: 'CAD',
  timezone: 'America/Vancouver',
  tax_name: 'GST/HST',
  tax_rate_bps: 500,
  tax_inclusive: false,
  tax_id_label: 'GST/HST number',
};

/** The mode's starter service, priced from AED at setup: CAD 9.40 / 30.00. */
const PRICE = { gents: 940, ladies: 3000 } as const satisfies Record<Mode, number>;
const cad = (minor: number) => `CAD ${(minor / 100).toFixed(2)}`;
const plain = (s: string) => s.replace(/ /g, ' ');

async function sellStarter(page: Page, mode: Mode) {
  await tab(page, 'sale');
  await id(page, `tile-${SERVICE[mode].name}-add`).click();
  await id(page, 'checkout').click();
}

test('a British Columbia salon picks its province: GST 5% and PST 7%, each on its own line', async ({ page, mode }) => {
  const owner = await createOwner(mode, { vat: true, country: CANADA });
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-branch').click();

  // Its tax depends on the province: saving asks for one.
  await id(page, 'branch-save').click();
  await expect(id(page, 'tax-province-error')).toHaveText('Pick your province');
  await id(page, 'tax-province-BC').click();
  await expect(id(page, 'tax-province-error')).toHaveCount(0);
  await expect(id(page, 'tax-kind-gst')).toHaveAttribute('aria-selected', 'true');
  await expect(field(page, 'tax_rate')).toHaveValue('5');
  await expect(id(page, 'tax-inclusive-add')).toHaveAttribute('aria-selected', 'true');
  await expect(field(page, 'tax2_name')).toHaveValue('PST');
  await expect(field(page, 'tax2_rate')).toHaveValue('7');
  // A CAD 100 service: GST 5.00 and PST 7.00 on their own lines.
  const example = id(page, 'tax-example');
  await expect.poll(async () => plain(await example.innerText())).toContain('GST (5%)');
  for (const part of ['CAD 5.00', 'PST (7%)', 'CAD 7.00', 'CAD 112.00']) expect(plain(await example.innerText())).toContain(part);
  await snap(page, 'tax-province-bc', mode);
  await id(page, 'branch-save').click();
  await expect(text(page, 'Settings saved')).toBeVisible();
  const { data: branch } = await admin.from('branches').select('tax_name, tax_rate_bps, tax2_name, tax2_rate_bps, settings').eq('id', owner.branchId).single();
  expect(branch).toMatchObject({ tax_name: 'GST', tax_rate_bps: 500, tax2_name: 'PST', tax2_rate_bps: 700 });
  expect((branch!.settings as { tax_region?: string }).tax_region).toBe('BC');

  // Checkout: 12% in all, of which PST 7/12 (the server's own split).
  const vat = Math.round((PRICE[mode] * 1200) / 10_000);
  const pst = Math.round((vat * 700) / 1200);
  await page.goto('/');
  await sellStarter(page, mode);
  // Each row: the tax and its rate, then its amount.
  await expect(text(page, 'GST 5%')).toBeVisible();
  await expect(text(page, 'PST 7%')).toBeVisible();
  await expect.poll(async () => plain(await id(page, 'checkout-vat').innerText())).toBe(cad(vat - pst));
  expect(plain(await id(page, 'checkout-tax2').innerText())).toBe(cad(pst));
  await snap(page, 'checkout-two-taxes', mode);
  await id(page, 'save-sale').click();
  await expect(id(page, 'sale-done')).toBeVisible();
  const sale = await latestSale(owner.branchId);
  expect(sale).toMatchObject({ vat_minor: vat, tax2_minor: pst, tax2_name: 'PST', total_minor: PRICE[mode] + vat });

  // The sale and its receipt.
  await page.goto('/sales');
  await id(page, `sale-row-${sale.number}`).click();
  await expect(text(page, 'GST 5%')).toBeVisible();
  await expect(text(page, 'PST 7%')).toBeVisible();
  await expect.poll(async () => plain(await id(page, 'sale-vat').innerText())).toBe(cad(vat - pst));
  expect(plain(await id(page, 'sale-tax2').innerText())).toBe(cad(pst));
  await page.getByRole('button', { name: 'Print receipt' }).click();
  await expect.poll(async () => plain(await printedText(page))).toContain(`GST (5%)`);
  const paper = plain(await printedText(page));
  for (const part of [cad(vat - pst), 'PST (7%)', cad(pst), cad(PRICE[mode] + vat)]) expect(paper).toContain(part);

  // The books: GST and PST owed apart.
  const { data: lines } = await admin
    .from('journal_lines')
    .select('debit_minor, credit_minor, accounts!inner(system_key), journal_entries!inner(source_type, business_id)')
    .eq('journal_entries.business_id', owner.businessId)
    .eq('journal_entries.source_type', 'sale');
  const owed = (key: string) =>
    (lines ?? [])
      .filter((l) => (l.accounts as unknown as { system_key: string }).system_key === key)
      .reduce((s, l) => s + l.credit_minor - l.debit_minor, 0);
  expect(owed('vat_payable')).toBe(vat - pst);
  expect(owed('tax2_payable')).toBe(pst);
});

test('a new Quebec salon picks its province at setup: GST 5% and QST 9.975%', async ({ page, mode }) => {
  const email = `qc-${uid()}@e2e.test`;
  const name = `Montréal ${mode} ${uid().slice(-6)}`;
  await chooseType(page, mode);
  await id(page, 'link-sign-up').click();
  await field(page, 'name').fill('Élodie Owner');
  await field(page, 'email').fill(email);
  await field(page, 'password').fill('Owner1234!');
  await id(page, 'sign-up-submit').click();

  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 30_000 });
  await field(page, 'businessName').fill(name);
  await id(page, 'setup-next').click();
  await id(page, 'setup-country-search').fill('canada');
  await id(page, 'setup-country-CA').click();
  await expect(id(page, 'setup-country-picked')).toContainText('CAD');
  await id(page, 'setup-next').click();
  await id(page, 'setup-next').click(); // salon type
  await field(page, 'branchName').fill('Plateau');
  await id(page, 'setup-next').click();
  await id(page, 'setup-vat').click();
  await id(page, 'setup-next').click();
  await expect(id(page, 'tax-province-error')).toHaveText('Pick your province');
  await id(page, 'tax-province-QC').click();
  await expect(id(page, 'tax-province-error')).toHaveCount(0);
  await expect(field(page, 'tax2_name')).toHaveValue('QST');
  await expect(field(page, 'tax2_rate')).toHaveValue('9.975');
  const example = id(page, 'tax-example');
  await expect.poll(async () => plain(await example.innerText())).toContain('QST (9.975%)');
  for (const part of ['GST (5%)', 'CAD 5.00', 'CAD 9.98', 'CAD 114.98']) expect(plain(await example.innerText())).toContain(part);
  await snap(page, 'setup-province-qc', mode);
  await id(page, 'setup-next').click();

  await expect(id(page, 'tab-index')).toBeVisible({ timeout: 30_000 });
  const { data: biz } = await admin.from('businesses').select('branches(tax_name, tax_rate_bps, tax_inclusive, tax2_name, tax2_rate_bps, settings)').eq('name', name).single();
  expect(biz!.branches[0]).toMatchObject({ tax_name: 'GST', tax_rate_bps: 500, tax_inclusive: false, tax2_name: 'QST', tax2_rate_bps: 997.5 });
  expect((biz!.branches[0]!.settings as { tax_region?: string }).tax_region).toBe('QC');
});
