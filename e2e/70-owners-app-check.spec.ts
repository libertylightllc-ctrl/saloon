/** The owner's app check, Part A (9 Nov 2026): payroll says when a sale came in after it was worked out and will
 * not be approved until it is worked out again (A1); the trial balance offers to fix a stock difference (A3); Home
 * shows the real compliance status (A4), a day off as "Day off" (A5) and an item that ran out (A6); sales leave the
 * tip out and show it apart (A7); an empty last month gives no percent badge (A8). */
import { admin, createOwner, createStaff, dubaiDate, employeeOf, sellCustom } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap, tab, text } from './support/ui';

test('payroll: a sale after the work-out blocks approval until it is worked out again', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 100_000 });
  const stylist = await createStaff(owner, 'staff'); // 10% commission
  const employee = await employeeOf(stylist.memberId);
  await sellCustom(owner.client, owner, { card: 10_000, employeeId: employee });
  const { error } = await owner.client.rpc('generate_payroll', { p_business: owner.businessId, p_period: dubaiDate(0).slice(0, 7) });
  if (error) throw error;
  // Saved after the work-out, so the month's commission is out of date.
  await sellCustom(owner.client, owner, { card: 20_000, employeeId: employee });

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-staff').click();
  await id(page, 'staff-payroll').click();
  await expect(id(page, 'payroll-stale')).toContainText('1 change since this was worked out');
  await expect(id(page, 'payroll-approve')).toBeDisabled();
  await snap(page, 'payroll-out-of-date', mode);

  await id(page, 'payroll-generate').click();
  await expect(text(page, 'Payroll worked out')).toBeVisible();
  await expect(id(page, 'payroll-stale')).toHaveCount(0);
  await expect(id(page, `slip-${stylist.name}`)).toContainText('30.00');
  await id(page, 'payroll-approve').click();
  await expect(text(page, 'Payroll approved and posted to the books')).toBeVisible();
});

test('Home and Reports: day off, out of stock, compliance, sales without the tip, no badge on an empty month', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 100_000 });
  const stylist = await createStaff(owner, 'staff');
  const employee = await employeeOf(stylist.memberId);
  // Rostered tomorrow only: today is a day off.
  const tomorrow = new Date(`${dubaiDate(1)}T12:00:00Z`).getUTCDay();
  const roster = await owner.client.rpc('set_roster', { p_employee: employee, p_days: [{ weekday: tomorrow, start: '10:00', end: '20:00' }] });
  if (roster.error) throw roster.error;
  // One thread in stock, then sold: out of stock.
  const item = await owner.client.rpc('save_item', {
    p: { business_id: owner.businessId, name: 'Test thread', kind: 'retail', unit: 'pcs', sell_price_minor: 500, reorder_level: 0 },
  });
  if (item.error) throw item.error;
  const opening = await owner.client.rpc('set_opening_stock', {
    p_branch: owner.branchId,
    p_items: [{ item_id: item.data, qty: 1, unit_cost_minor: 100 }],
  });
  if (opening.error) throw opening.error;
  const sold = await owner.client.rpc('create_sale', {
    p: {
      branch_id: owner.branchId,
      client_ref: crypto.randomUUID(),
      lines: [{ kind: 'retail', item_id: item.data, qty: 1 }],
      payments: [{ method: 'cash', amount_minor: 500 }],
    },
  });
  if (sold.error) throw sold.error;
  // AED 90.00 of service and a AED 10.00 tip.
  await sellCustom(owner.client, owner, { card: 10_000, tip: 1_000, employeeId: employee });

  await ownerOn(page, mode, owner.email, owner.password);
  await expect(id(page, 'attention-low-stock')).toContainText('1 item out of stock');
  await expect(id(page, 'attention-low-stock')).toContainText('Test thread');
  // Records never entered are "Missing", not "Expired".
  await expect(id(page, 'attention-compliance')).toContainText('Missing');
  await expect(id(page, 'attention-compliance')).not.toContainText('Expired');
  await expect(text(page, 'Day off').first()).toBeVisible();
  await expect(id(page, 'kpi-sales-value')).toContainText('95.00');
  await expect(id(page, 'kpi-sales-sub')).toContainText('Tips: AED 10.00');
  await snap(page, 'home-app-check', mode);

  await tab(page, 'more');
  await id(page, 'more-reports').click();
  await expect(id(page, 'report-kpi-sales-value')).toContainText('AED 95.00');
  await expect(id(page, 'report-kpi-tips-value')).toContainText('AED 10.00');
  await expect(id(page, 'report-kpi-revenue')).toContainText('After refunds and discounts');
  await expect(id(page, 'report-kpi-revenue')).not.toContainText('%');
  await snap(page, 'reports-monthly-tips', mode);
});

test('trial balance: a stock difference is named and fixed with one entry', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const item = await owner.client.rpc('save_item', {
    p: { business_id: owner.businessId, name: 'Test gloves', kind: 'consumable', unit: 'pcs', reorder_level: 0 },
  });
  if (item.error) throw item.error;
  const opening = await owner.client.rpc('set_opening_stock', {
    p_branch: owner.branchId,
    p_items: [{ item_id: item.data, qty: 10, unit_cost_minor: 50 }],
  });
  if (opening.error) throw opening.error;
  // An old gap like the one found on the live database: the stock's value no longer matches 1200 Stock.
  const { error } = await admin.from('inventory_items').update({ avg_unit_cost_minor: 55 }).eq('id', item.data as string);
  if (error) throw error;

  await ownerOn(page, mode, owner.email, owner.password);
  await page.goto('/accounts');
  await id(page, 'accounts-tab-balance').click();
  await expect(id(page, 'stock-check')).toContainText("Stock doesn't match");
  await expect(id(page, 'stock-check')).toContainText('0.50');
  await id(page, 'stock-fix').click();
  await id(page, 'stock-fix-do').click();
  await expect(text(page, 'Stock difference fixed')).toBeVisible();
  await expect(id(page, 'stock-check')).toHaveCount(0);
  await expect(text(page, 'Balanced: Yes')).toBeVisible();
  await expect(id(page, 'tb-inventory')).toContainText('5.50');
});
