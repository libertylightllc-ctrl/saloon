/**
 * Owner feedback 2026-09-30: a service without a time; the staff name on sales and receipts; purchase lines as
 * quantity + amount (100 ml for AED 45); VAT on bills and expenses; the VAT report; show password.
 */
import { admin, createOwner, createStaff, employeeOf, sellCustom } from './support/api';
import { expect, test } from './support/fixtures';
import { back, chooseType, expectMoney, field, id, ownerOn, snap, tab, text } from './support/ui';

test('services without a time, and who did each sale on the list, the sale and the receipt', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const barber = await createStaff(owner, 'staff', { name: 'Rafiq Feedback' });
  const sale = await sellCustom(owner.client, owner, { cash: 6_000, employeeId: await employeeOf(barber.memberId) });
  const { data: saleRow } = await admin.from('sales').select('number').eq('id', sale.sale_id).single();
  const { data: category } = await admin.from('service_categories').select('name').eq('business_id', owner.businessId).limit(1).single();

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-services').click();
  await id(page, 'services-new').click();
  await field(page, 'name').fill('Quick fringe');
  await id(page, `category-${category!.name}`).click();
  await field(page, 'price_minor').fill('20');
  await expect(field(page, 'duration_min')).toHaveValue('');
  await id(page, 'service-save').click();
  await expect(id(page, 'service-Quick fringe')).toBeVisible();
  await expect(id(page, 'service-Quick fringe')).not.toContainText('min');

  // The walk-in with only that service still goes in the queue.
  await page.goto('/queue');
  await id(page, 'queue-new').click();
  await id(page, 'pick-service-Quick fringe').click();
  await id(page, 'appointment-submit').click();
  // Back on the queue, with the walk-in on it.
  await expect(page).toHaveURL(/\/queue$/);
  await expect(text(page, /Quick fringe · AED\s20\.00/).first()).toBeVisible(); // a no-break space keeps "AED 20.00" together

  // Sales: the list and the sale show who did it; the printed receipt says "Served by".
  await page.goto('/sales');
  await expect(id(page, `sale-row-${saleRow!.number}`)).toContainText('Rafiq Feedback');
  await id(page, `sale-row-${saleRow!.number}`).click();
  await expect(id(page, 'sale-line-staff')).toContainText('by Rafiq Feedback');
  await page.getByRole('button', { name: 'Print receipt' }).click();
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('iframe[data-receipt]') as HTMLIFrameElement | null)?.contentDocument?.body?.innerText ?? ''))
    .toContain('Served by: Rafiq Feedback');
  await snap(page, 'sale-staff', mode);
});

test('a VAT-registered salon buys a 100 ml bottle for AED 45 + VAT, pays a phone bill with VAT, and reads its VAT report', async ({ page, mode }) => {
  const owner = await createOwner(mode, { vat: true });
  await owner.client.rpc('save_item', { p: { business_id: owner.businessId, name: 'Argan oil 100', kind: 'consumable', unit: 'ml', pack_size: 100 } });
  await owner.client.rpc('save_supplier', { p: { business_id: owner.businessId, name: 'Beauty Trading', terms_days: 30 } });
  await sellCustom(owner.client, owner, { card: 21_000 });

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-purchases').click();
  await id(page, 'bills-new').click();
  await id(page, 'bill-supplier-Beauty Trading').click();
  await id(page, 'bill-add-item').click();
  await id(page, 'bill-item-Argan oil 100').click();
  // The item's bottle size is filled in; one bottle at 45.00 is 45 fils a ml, with 5% VAT on top.
  await expect(id(page, 'bill-line-pack-0')).toHaveValue('100');
  await id(page, 'bill-line-qty-0').fill('1');
  await id(page, 'bill-line-price-0').fill('45');
  await expect(id(page, 'bill-line-vat-0')).toHaveValue('2.25');
  await expect(id(page, 'bill-line-stock-0')).toContainText('100 ml into stock');
  await expect(id(page, 'bill-line-stock-0')).toContainText('AED 0.45 per ml');
  await expectMoney(page, 'bill-total', 4725);
  await id(page, 'bill-save').click();
  await expectMoney(page, 'bill-detail-vat', 225);
  await expectMoney(page, 'bill-detail-total', 4725);
  await expect(id(page, 'bill-detail-line-0')).toContainText('100 ml');
  await snap(page, 'bill-vat', mode);

  // An expense with VAT inside: 105.00 paid, 5.00 of it VAT.
  await page.goto('/expenses/new');
  await id(page, 'expense-amount').fill('105');
  await id(page, 'expense-category-internet_phone').click();
  await id(page, 'expense-method-card').click();
  await id(page, 'expense-with-vat').click();
  await expect(id(page, 'expense-vat')).toHaveValue('5.00');
  await id(page, 'expense-save').click();
  await expect(text(page, 'Expense saved')).toBeVisible();

  // The VAT report: 10.00 collected on the 210.00 sale, 7.25 paid, 2.75 to pay.
  await page.goto('/reports?type=vat');
  await expect(id(page, 'report-kpi-output-value')).toContainText('AED 10.00');
  await expect(id(page, 'report-kpi-input-value')).toContainText('AED 7.25');
  await expect(id(page, 'report-kpi-due-value')).toContainText('AED 2.75');
  await expect(id(page, 'report-row-purchases')).toContainText('AED 45.00');
  await snap(page, 'report-vat', mode);
  await back(page);
});

test('passwords can be shown and hidden', async ({ page, mode }) => {
  await chooseType(page, mode);
  await id(page, 'sign-in-as-owner').click();
  await field(page, 'password').fill('Secret123!');
  await expect(field(page, 'password')).toHaveAttribute('type', 'password');
  await id(page, 'field-password-reveal').click();
  await expect(field(page, 'password')).not.toHaveAttribute('type', 'password');
  await expect(field(page, 'password')).toHaveValue('Secret123!');
  await expect(id(page, 'field-password-reveal')).toHaveAttribute('aria-label', 'Hide password');
  await id(page, 'field-password-reveal').click();
  await expect(field(page, 'password')).toHaveAttribute('type', 'password');
});
