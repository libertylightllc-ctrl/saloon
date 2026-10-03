/** Books & reports: six reports with month picker, chart, PDF and CSV; month close; ledger CSV; who sees what. */
import { readFileSync } from 'node:fs';

import type { Page } from '@playwright/test';

import { admin, createOwner, createStaff, dubaiDate, employeeOf, journalTotals, staffEmail, userClient, type Owner } from './support/api';
import { expect, test } from './support/fixtures';
import { id, idStarts, ownerOn, snap, staffOn, tab, text, visibleTabs } from './support/ui';

async function download(page: Page, testId: string): Promise<string> {
  const [file] = await Promise.all([page.waitForEvent('download'), id(page, testId).click()]);
  return readFileSync((await file.path())!, 'utf8');
}

async function sale(owner: Owner, opts: { price: number; method?: string; employeeId?: string; customerId?: string }) {
  const { data, error } = await owner.client.rpc('create_sale', {
    p: {
      branch_id: owner.branchId,
      client_ref: crypto.randomUUID(),
      employee_id: opts.employeeId,
      customer_id: opts.customerId,
      lines: [{ kind: 'custom', name: 'Fade & beard', unit_price_minor: opts.price }],
      payments: [{ method: opts.method ?? 'cash', amount_minor: opts.price }],
    },
  });
  if (error) throw error;
  return data as { sale_id: string };
}

/** A month back in Dubai, e.g. "2026-08", and a date in it. */
const lastMonth = () => {
  const [y, m] = dubaiDate().split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 2, 15));
  return { month: d.toISOString().slice(0, 7), date: d.toISOString().slice(0, 10) };
};

test('owner reads every report, exports PDF and CSV, closes last month and exports the ledger', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 20_000 });
  const cashier = await createStaff(owner, 'cashier');
  const barber = await createStaff(owner, 'staff', { name: 'Rafiq Report', commissionBps: 1000 });
  const barberId = await employeeOf(barber.memberId);
  const { data: customer, error } = await owner.client
    .from('customers')
    .insert({ business_id: owner.businessId, name: 'Omar Report', phone: '+971 50 222 3333' })
    .select('id')
    .single();
  if (error) throw error;
  const { data: itemId, error: itemError } = await owner.client.rpc('save_item', {
    p: { business_id: owner.businessId, name: 'Report Wax', kind: 'retail', sell_price_minor: 4_500 },
  });
  if (itemError) throw itemError;
  const { error: stockError } = await owner.client.rpc('set_opening_stock', {
    p_branch: owner.branchId,
    p_items: [{ item_id: itemId, qty: 10, unit_cost_minor: 2_000 }],
  });
  if (stockError) throw stockError;
  await sale(owner, { price: 12_000, employeeId: barberId, customerId: customer.id });
  await sale(owner, { price: 8_000, method: 'card', employeeId: barberId });
  // The cashier closes today AED 5.00 short, with a reason.
  const till = await userClient(staffEmail(owner.code, cashier.username), cashier.password);
  const { data: preview, error: previewError } = await till.rpc('closing_preview', { p_branch: owner.branchId });
  if (previewError) throw previewError;
  const { error: countError } = await till.rpc('submit_cash_count', {
    p: {
      branch_id: owner.branchId,
      counted_cash_minor: (preview as { expected_cash_minor: number }).expected_cash_minor - 500,
      submit: true,
      drawer_closed_confirmed: true,
      reason: 'Change given twice',
    },
  });
  if (countError) throw countError;
  // Last month: one sale moved back (after today's close), so there is a finished month to close.
  const old = await sale(owner, { price: 5_000, method: 'card' });
  const last = lastMonth();
  for (const q of [
    admin.from('sales').update({ business_date: last.date }).eq('id', old.sale_id),
    admin.from('journal_entries').update({ business_date: last.date }).eq('source_id', old.sale_id),
  ]) {
    const { error: moveError } = await q;
    if (moveError) throw moveError;
  }

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-reports').click();

  // Monthly business: this month's two sales; the owner control line.
  await expect(id(page, 'report-kpi-sales-value')).toContainText('AED 200.00');
  await expect(id(page, 'report-control')).toContainText('short by AED 5.00');
  await expect(id(page, 'report-control')).toContainText('Compliance issues');
  await expect(id(page, 'report-chart')).toBeVisible();
  await snap(page, 'report-monthly', mode);
  const monthly = await download(page, 'report-csv');
  expect(monthly.split('\r\n')[0]).toContain('Date,Sales,Services,Refunds,Expenses');
  expect(monthly).toContain(`${dubaiDate()},200.00`);
  await id(page, 'report-pdf').click();
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('iframe[data-receipt]') as HTMLIFrameElement | null)?.contentDocument?.body?.innerText ?? ''))
    .toContain('Monthly business');
  // Last month: the moved sale.
  await page.getByRole('button', { name: 'Previous month' }).filter({ visible: true }).first().click();
  await expect(id(page, 'report-kpi-sales-value')).toContainText('AED 50.00');
  await page.getByRole('button', { name: 'Next month' }).filter({ visible: true }).first().click();

  // Staff sales: the barber's sales and 10% commission.
  await id(page, 'report-type-staff').click();
  await expect(id(page, `report-row-${barberId}`)).toContainText('AED 200.00');
  await expect(id(page, `report-row-${barberId}`)).toContainText('AED 20.00');
  const staffCsv = await download(page, 'report-csv');
  expect(staffCsv).toContain('Rafiq Report,0,200.00,200.00,20.00,0.00');

  // Daily closing and cash shortages: the short close with its reason.
  await id(page, 'report-type-closing').click();
  await expect(id(page, `report-row-${dubaiDate()}`)).toContainText('-AED 5.00');
  await id(page, 'report-type-shortages').click();
  await expect(id(page, `report-row-${dubaiDate()}`)).toContainText('Change given twice');
  expect(await download(page, 'report-csv')).toContain('Change given twice');

  // Stock movement: the opening stock came in this month; 10 × 20.00 on hand.
  await id(page, 'report-type-stock').click();
  await expect(id(page, `report-row-${itemId}`)).toContainText('+10');
  await expect(id(page, `report-row-${itemId}`)).toContainText('AED 200.00');
  await id(page, 'report-type-customers').click();
  await expect(id(page, `report-row-${customer.id}`)).toContainText('Omar Report');
  await expect(id(page, `report-row-${customer.id}`)).toContainText('AED 120.00');
  await snap(page, 'report-customers', mode);

  // Close last month; reopening needs a reason.
  await page.goto('/accounts/close-period');
  await id(page, `period-${last.month}-close`).click();
  await id(page, 'period-confirm').click();
  await expect(id(page, `period-${last.month}`)).toContainText('Closed');
  await id(page, `period-${last.month}-reopen`).click();
  await id(page, 'period-reason').fill('x');
  await id(page, 'period-confirm').click();
  await expect(text(page, 'Write a reason (at least 3 characters).')).toBeVisible();
  await id(page, 'period-reason').fill('Supplier bill came late');
  await id(page, 'period-confirm').click();
  await expect(id(page, `period-${last.month}`)).toContainText('Open');
  await snap(page, 'close-period', mode);

  // Ledger CSV: every journal line, debits = credits, the same as the books.
  const ledger = (await download(page, 'ledger-csv')).replace(/^\uFEFF/, '').trim().split('\r\n');
  const rows = ledger.slice(1).map((l) => l.split(','));
  const debit = rows.reduce((n, r) => n + Math.round(Number(r.at(-2) || 0) * 100), 0);
  const credit = rows.reduce((n, r) => n + Math.round(Number(r.at(-1) || 0) * 100), 0);
  const books = await journalTotals(owner.businessId);
  expect(debit).toBe(credit);
  expect(debit).toBe(books.debit);
});

test('the accountant has Reports and Accounting tabs, reads and exports, but cannot close a month; a cashier sees neither', async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { openingCash: 20_000 });
  const accountant = await createStaff(owner, 'accountant');
  const cashier = await createStaff(owner, 'cashier');
  await sale(owner, { price: 9_000 });

  await staffOn(page, mode, owner.code, accountant.username, accountant.password);
  // The accountant can look at cash closings but not close a day, and Home says so.
  await expect(id(page, 'home-close-day')).toHaveText('Cash closing');
  expect(await visibleTabs(page)).toEqual(['index', 'reports-tab', 'accounts-tab', 'more']);
  await id(page, 'tab-reports-tab').click();
  await expect(id(page, 'report-kpi-sales-value')).toContainText('AED 90.00');
  await expect(id(page, 'report-control')).not.toContainText('Compliance issues');
  expect(await download(page, 'report-csv')).toContain('90.00');
  await id(page, 'tab-accounts-tab').click();
  await expect(text(page, 'Balanced: Yes')).toBeVisible();
  await id(page, 'accounts-months').click();
  await expect(idStarts(page, 'period-')).not.toHaveCount(0);
  await expect(page.locator('[data-testid$="-close"]')).toHaveCount(0);
  await expect(id(page, 'ledger-csv')).toBeVisible();

  const phone = await device();
  await staffOn(phone, mode, owner.code, cashier.username, cashier.password);
  await tab(phone, 'more');
  await expect(id(phone, 'more-reports')).toHaveCount(0);
  await phone.goto('/reports');
  await expect(id(phone, 'tab-index')).toHaveAttribute('aria-selected', 'true');
});
