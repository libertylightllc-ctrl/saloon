/**
 * Salons in any country (owner, 2026-10-04): the country chosen at setup brings the currency, time zone and sales
 * tax; tax can be added at the till (US) instead of included in prices; a 3-decimal currency (KWD) counts in
 * thousandths; UAE-only features (WPS, Montaji, the UAE document checklist) stay with UAE salons; the plan is USD 29.
 */
import type { Page } from '@playwright/test';

import { admin, createOwner, KUWAIT, latestSale, type Mode } from './support/api';
import { SERVICE } from './support/catalog';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { chooseType, expectMoney, field, id, ownerOn, snap, tab, text } from './support/ui';

/** The mode's starter service, priced from AED at setup: USD 6.80 / 22.00 and KWD 2.100 / 6.600. */
const PRICE = {
  US: { gents: 680, ladies: 2200 },
  KW: { gents: 2100, ladies: 6600 },
} as const satisfies Record<string, Record<Mode, number>>;

async function sellStarter(page: Page, mode: Mode) {
  await tab(page, 'sale');
  await id(page, `tile-${SERVICE[mode].name}-add`).click();
  await id(page, 'checkout').click();
}

test('a New York salon: dollars, sales tax 8.875% added at the till, the receipt and a USD 29 plan', async ({ page, mode }) => {
  const email = `ny-${uid()}@e2e.test`;
  const name = `Brooklyn ${mode} ${uid().slice(-6)}`;
  await chooseType(page, mode);
  await id(page, 'link-sign-up').click();
  await field(page, 'name').fill('Nia Owner');
  await field(page, 'email').fill(email);
  await field(page, 'password').fill('Owner1234!');
  await field(page, 'confirm').fill('Owner1234!');
  await id(page, 'sign-up-submit').click();

  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 30_000 });
  await field(page, 'businessName').fill(name);
  await id(page, 'setup-next').click();
  // The phone is in Dubai, so the UAE is proposed; the owner picks the United States.
  await expect(id(page, 'setup-country-picked')).toContainText('AED');
  await id(page, 'setup-country-search').fill('united st');
  await id(page, 'setup-country-US').click();
  await expect(id(page, 'setup-country-picked')).toContainText('USD');
  await expect(id(page, 'setup-country-picked')).toContainText('America/New_York');
  await snap(page, 'setup-country', mode);
  await id(page, 'setup-next').click();
  await id(page, 'setup-next').click(); // salon type
  await field(page, 'branchName').fill('Williamsburg');
  await id(page, 'setup-next').click();
  // Registered for sales tax: 8.875%, added at the till, no tax number yet.
  await id(page, 'setup-vat').click();
  await expect(field(page, 'tax_name')).toHaveValue('Sales tax');
  await field(page, 'tax_rate').fill('8.875');
  await expect(id(page, 'tax-inclusive-add')).toHaveAttribute('aria-selected', 'true');
  await expect(id(page, 'tax-example')).toContainText('USD 108.88');
  await field(page, 'openingCash').fill('100');
  await snap(page, 'setup-us-tax', mode);
  await id(page, 'setup-next').click();

  await expect(id(page, 'tab-index')).toBeVisible({ timeout: 30_000 });
  await expect(id(page, 'kpi-expected-cash-value')).toContainText('USD 100.00');
  const { data: biz } = await admin.from('businesses').select('id, country_code, currency, timezone, branches(id, tax_name, tax_rate_bps, tax_inclusive, vat_mode)').eq('name', name).single();
  expect(biz).toMatchObject({ country_code: 'US', currency: 'USD', timezone: 'America/New_York' });
  expect(biz!.branches[0]).toMatchObject({ tax_name: 'Sales tax', tax_rate_bps: 887.5, tax_inclusive: false, vat_mode: 'on' });

  // The plan outside the UAE: USD 29 a branch. The platform owner switches it on.
  await tab(page, 'more');
  await id(page, 'more-plan').click();
  await expect(id(page, 'plan-price')).toHaveText('USD 29.00');
  await admin.from('subscriptions').upsert({ business_id: biz!.id, paid_until: '2099-12-31' });
  await expect(text(page, 'Paid until 31 December 2099.')).toBeVisible();
  await page.goto('/');

  // The starter service in dollars; 8.875% is added on top and the customer pays it.
  const price = PRICE.US[mode];
  const tax = Math.round((price * 887.5) / 10_000);
  await sellStarter(page, mode);
  await expect(id(page, 'checkout-vat')).toHaveText(`USD ${(tax / 100).toFixed(2)}`);
  await expectMoney(page, 'checkout-due', price + tax);
  await id(page, 'save-sale').click();
  await expect(id(page, 'sale-done')).toBeVisible();
  await expectMoney(page, 'sale-done-total', price + tax);
  const sale = await latestSale(biz!.branches[0]!.id);
  expect(sale).toMatchObject({ total_minor: price + tax, vat_minor: tax, tax_rate_bps: 887.5, tax_inclusive: false });

  // The receipt: dollars, and the sales tax at its rate.
  await page.goto('/sales');
  await id(page, `sale-row-${sale.number}`).click();
  await page.getByRole('button', { name: 'Print receipt' }).click();
  const receipt = () => page.evaluate(() => (document.querySelector('iframe[data-receipt]') as HTMLIFrameElement | null)?.contentDocument?.body?.innerText ?? '');
  await expect.poll(receipt).toContain('Sales tax (8.875%)');
  await expect.poll(receipt).toContain(`USD ${((price + tax) / 100).toFixed(2)}`);
});

test('a Kuwait salon: dinars with three decimals, no VAT, no WPS or Montaji, its own checklist and dinar notes', async ({ page, mode }) => {
  const owner = await createOwner(mode, { country: KUWAIT, openingCash: 20_000 });
  await ownerOn(page, mode, owner.email, owner.password);
  await expect(id(page, 'kpi-expected-cash-value')).toContainText('KWD 20.000');

  const price = PRICE.KW[mode];
  await sellStarter(page, mode);
  await expect(id(page, 'checkout-vat')).toHaveText('Not applied');
  await expect(id(page, 'checkout-due')).toHaveText(`KWD ${(price / 1000).toFixed(3)}`);
  await id(page, 'save-sale').click();
  await expect(id(page, 'sale-done')).toBeVisible();
  expect(await latestSale(owner.branchId)).toMatchObject({ total_minor: price, vat_minor: 0 });
  await id(page, 'new-sale').click();

  // Staff pay without the UAE's WPS.
  await tab(page, 'more');
  await id(page, 'more-staff').click();
  await id(page, 'staff-add').click();
  await expect(id(page, 'staff-salary')).toBeVisible();
  await expect(id(page, 'staff-wps')).toHaveCount(0);

  // Compliance: a business licence and the lease; no Ejari, no WPS & Montaji tab.
  await page.goto('/compliance');
  await expect(id(page, `doc-business_licence-E2E ${mode} branch`)).toBeVisible();
  await expect(id(page, `doc-lease-E2E ${mode} branch`)).toBeVisible();
  await expect(id(page, `doc-ejari-E2E ${mode} branch`)).toHaveCount(0);
  await expect(id(page, 'compliance-tab-wps')).toHaveCount(0);

  // Closing the day: the drawer counted in dinar notes, down to the quarter dinar.
  await page.goto('/');
  await id(page, 'home-close-day').click();
  await expect(id(page, 'closing-expected')).toContainText(`KWD ${((20_000 + price) / 1000).toFixed(3)}`);
  await id(page, 'closing-count-notes').click();
  await expect(text(page, 'KWD 0.25 notes')).toBeVisible();
  await id(page, 'denom-20000').fill('1');
  await id(page, 'denom-250').fill('2');
  await expect(id(page, 'denom-total')).toContainText('KWD 20.500');
  await snap(page, 'closing-kwd', mode);
});
