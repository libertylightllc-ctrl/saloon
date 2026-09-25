import { createOwner, stockQty } from './support/api';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { back, field, id, idStarts, ownerOn, snap, tab, text } from './support/ui';

test('owner adds a category and a service with a recipe; it appears in Quick sale', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const category = `Cat ${uid().slice(-4)}`;
  const service = `Service ${uid().slice(-4)}`;
  const product = mode === 'gents' ? 'Hair Oil' : 'Heat spray';

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-services').click();
  await id(page, 'services-categories').click();
  await id(page, 'category-new').click();
  await id(page, 'category-name').fill(category);
  await id(page, 'category-save').click();
  await expect(id(page, `category-row-${category}`)).toBeVisible();
  await back(page);

  await id(page, 'services-new').click();
  await id(page, 'service-save').click();
  await expect(text(page, 'Pick a category')).toBeVisible();
  await field(page, 'name').fill(service);
  await id(page, `category-${category}`).click();
  await field(page, 'price_minor').fill('42.50');
  await field(page, 'duration_min').fill('25');
  await id(page, `recipe-add-${product}`).click();
  await id(page, 'service-save').click();
  await expect(text(page, 'Enter how much of each item is used')).toBeVisible();
  await id(page, `recipe-qty-${product}`).fill('12');
  // A brand-new product is created with the service.
  await id(page, 'recipe-new').click();
  await id(page, 'recipe-new-name').fill(`Towel ${uid().slice(-3)}`);
  await id(page, 'recipe-new-add').click();
  const newItem = idStarts(page, 'recipe-qty-Towel');
  await newItem.fill('1');
  await id(page, 'service-save').click();
  await expect(id(page, `service-${service}`)).toBeVisible();
  await expect(id(page, `service-${service}`)).toContainText(`${product} 12 ml`);
  await snap(page, 'services-list', mode);

  await back(page);
  await tab(page, 'sale');
  const tile = text(page, service, true);
  await expect(tile).toBeVisible();
  await expect(text(page, 'AED 42.50').first()).toBeVisible();
  expect(await stockQty(owner.branchId, owner.businessId, product)).toBe(0);
});
