/** Inventory & tools: add a retail product, sell it in Quick sale, refund it back onto the shelf, adjust with a
 * reason, count the shelf; low stock and tools due show on Home; staff see levels but never costs. */
import { admin, createOwner, createStaff } from './support/api';
import { expect, test } from './support/fixtures';
import { back, expectMoney, id, ownerOn, snap, staffOn, tab, text } from './support/ui';

const PRODUCT = { gents: 'Beard Oil 30 ml', ladies: 'Argan Hair Oil' } as const;

test('owner adds a product, sells it, refunds it to stock, adjusts and counts; Home flags low stock', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 10_000 });
  const product = PRODUCT[mode];
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-inventory').click();

  // Add: retail, counted in pieces, reorder at 3, sells at 60.00.
  await id(page, 'inventory-add').click();
  await id(page, 'item-name').fill(product);
  await id(page, 'item-kind-retail').click();
  await id(page, 'item-reorder').fill('3');
  await id(page, 'item-price').fill('60');
  await id(page, 'item-location').fill('Reception shelf');
  await id(page, 'item-save').click();
  await expect(text(page, 'Item saved')).toBeVisible();
  await expect(id(page, 'item-qty')).toHaveText('0 pc');

  // Ten in at 25.00 each (opening stock through the same RPC the setup wizard uses).
  const { data: item } = await admin.from('inventory_items').select('id').eq('business_id', owner.businessId).eq('name', product).single();
  const { error } = await owner.client.rpc('set_opening_stock', {
    p_branch: owner.branchId,
    p_items: [{ item_id: item!.id, qty: 10, unit_cost_minor: 2500 }],
  });
  expect(error).toBeNull();
  await page.reload();
  await expect(id(page, 'item-qty')).toHaveText('10 pc');
  await expectMoney(page, 'item-value', 25_000);
  await back(page);
  await back(page);

  // Sell two in Quick sale → Products.
  await tab(page, 'sale');
  await id(page, 'sale-tab-products').click();
  await id(page, `product-${product}-add`).click();
  await id(page, `product-${product}-plus`).click();
  await expectMoney(page, 'basket-total', 12_000);
  await id(page, 'checkout').click();
  await expectMoney(page, 'checkout-due', 12_000);
  await id(page, 'save-sale').click();
  await expect(id(page, 'sale-done')).toBeVisible();
  await id(page, 'new-sale').click();

  await tab(page, 'more');
  await id(page, 'more-inventory').click();
  await expect(id(page, `item-${product}-qty`)).toHaveText('8 pc');

  // Refund the whole sale and put both back on the shelf.
  await back(page);
  await id(page, 'more-sales').click();
  await page.locator('[data-testid^="sale-row-"]').filter({ visible: true }).first().click();
  await id(page, 'sale-refund').click();
  await id(page, 'refund-reason').fill('Unopened, returned');
  await id(page, 'refund-restock').click();
  await id(page, 'refund-confirm').click();
  await expect(text(page, 'Refunded AED 120.00')).toBeVisible();
  await back(page);
  await back(page);
  await id(page, 'more-inventory').click();
  await expect(id(page, `item-${product}-qty`)).toHaveText('10 pc');

  // Adjust: one broke.
  await id(page, `item-${product}`).click();
  await expect(id(page, 'movement-retail_sale')).toBeVisible();
  await expect(id(page, 'movement-reversal')).toBeVisible();
  await id(page, 'item-adjust').click();
  await id(page, 'adjust-qty').fill('1');
  await expect(id(page, 'adjust-save')).toHaveAttribute('aria-disabled', 'true'); // reason required
  await id(page, 'adjust-reason').fill('Bottle broke');
  await id(page, 'adjust-save').click();
  await expect(text(page, 'Stock adjusted')).toBeVisible();
  await expect(id(page, 'item-qty')).toHaveText('9 pc');
  await expect(text(page, 'Bottle broke', false).first()).toBeVisible();
  await snap(page, 'inventory-item', mode);
  await back(page);

  // Count the shelf: only 3 there → low stock.
  await id(page, 'inventory-count').click();
  await id(page, `count-${product}`).fill('3');
  await id(page, 'count-save').click();
  await expect(text(page, 'Count saved: 1 changed, -AED 150.00')).toBeVisible();
  await expect(id(page, `item-${product}-qty`)).toHaveText('3 pc');
  await expect(id(page, `item-${product}`)).toContainText('Low');
  await expect(id(page, 'inventory-low-value')).toHaveText('1');
  await expectMoney(page, 'inventory-value-value', 7_500);
  await id(page, 'inventory-filter-low').click();
  await expect(id(page, `item-${product}`)).toBeVisible();
  await snap(page, 'inventory-list', mode);
  await back(page);

  // Home asks for an order; the books balance.
  await tab(page, 'index');
  await expect(id(page, 'attention-low-stock')).toContainText(product);
  await tab(page, 'more');
  await id(page, 'more-accounts').click();
  await id(page, 'accounts-tab-journal').click();
  await expect(id(page, 'journal-stock_adjustment')).toHaveCount(1);
  await expect(id(page, 'journal-stock_count')).toHaveCount(1);
  await id(page, 'accounts-tab-balance').click();
  await expect(text(page, 'Balanced: Yes')).toBeVisible();
  await expect(id(page, 'tb-inventory')).toContainText('75.00');
});

test('a tool that needs a service shows on Home; staff see levels without costs; cashier cannot adjust', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const staff = await createStaff(owner, 'staff');
  const cashier = await createStaff(owner, 'cashier');
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-inventory').click();
  await id(page, 'inventory-add').click();
  await id(page, 'item-name').fill('Cordless Clipper');
  await id(page, 'item-kind-tool').click();
  await id(page, 'item-condition-needs_service').click();
  await id(page, 'item-assigned').fill('Chair 2');
  await id(page, 'item-save').click();
  await expect(text(page, 'Item saved')).toBeVisible();
  await expect(id(page, 'item-condition')).toHaveText('Needs service');
  await back(page);
  await id(page, 'inventory-filter-tool').click();
  await expect(id(page, 'item-Cordless Clipper')).toContainText('With Chair 2');
  await back(page);
  await tab(page, 'index');
  await expect(id(page, 'attention-tools-due')).toBeVisible();

  const phone = await device();
  await staffOn(phone, mode, owner.code, staff.username, staff.password);
  await tab(phone, 'more');
  await id(phone, 'more-inventory').click();
  await expect(id(phone, 'item-Cordless Clipper')).toBeVisible();
  await expect(id(phone, 'inventory-value-value')).toHaveCount(0);
  await expect(id(phone, 'inventory-add')).toHaveCount(0);
  await expect(id(phone, 'inventory-count')).toHaveCount(0);
  await id(phone, 'item-Cordless Clipper').click();
  await expect(id(phone, 'item-adjust')).toHaveCount(0);
  await expect(id(phone, 'item-value')).toHaveCount(0);
  await phone.goto('/inventory/count');
  await expect(id(phone, 'tab-index')).toHaveAttribute('aria-selected', 'true');

  const till = await device('cashier');
  await staffOn(till, mode, owner.code, cashier.username, cashier.password);
  await tab(till, 'more');
  await id(till, 'more-inventory').click();
  await expect(id(till, 'inventory-value-value')).toBeVisible();
  await expect(id(till, 'inventory-order')).toBeVisible();
  await expect(id(till, 'inventory-count')).toHaveCount(0);
  await id(till, 'item-Cordless Clipper').click();
  await expect(id(till, 'item-adjust')).toHaveCount(0);
});
