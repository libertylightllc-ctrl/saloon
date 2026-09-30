/**
 * Pop-up panels (bottom sheets) closed by a tap outside them open again. Before the fix, closing the checkout by
 * tapping outside left the Checkout button dead until the page was reloaded (owner report 2026-09-30).
 */
import type { Page } from '@playwright/test';

import { createOwner } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { id, ownerOn, tab } from './support/ui';

/** A real tap or click (waits until the target has stopped moving). */
async function press(page: Page, testId: string, touch: boolean) {
  if (touch) await id(page, testId).tap();
  else await id(page, testId).click();
}

/** Tap the dimmed area above an open sheet (its backdrop, labelled "Close"). */
async function tapOutside(page: Page, touch: boolean) {
  const backdrop = page.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true }).first();
  if (touch) await backdrop.tap({ position: { x: 180, y: 20 } });
  else await backdrop.click({ position: { x: 180, y: 20 } });
}

for (const touch of [true, false]) {
  test.describe(touch ? 'touch' : 'mouse', () => {
    test.use({ hasTouch: touch });

    test(`checkout and the language panel open again after a tap outside closes them (${touch ? 'touch' : 'mouse'})`, async ({ page, mode }) => {
      const owner = await createOwner(mode);
      await ownerOn(page, mode, owner.email, owner.password);
      await tab(page, 'sale');
      await id(page, `tile-${SERVICE[mode].name}-add`).click();
      for (let i = 0; i < 3; i++) {
        await press(page, 'checkout', touch);
        await expect(id(page, 'save-sale')).toBeVisible();
        await tapOutside(page, touch);
        await expect(id(page, 'save-sale')).toHaveCount(0);
      }
      // It still works for real: the next opening saves a sale.
      await press(page, 'checkout', touch);
      await id(page, 'save-sale').click();
      await expect(id(page, 'sale-done')).toBeVisible();
      await id(page, 'new-sale').click();

      await tab(page, 'more');
      for (let i = 0; i < 2; i++) {
        await press(page, 'more-language', touch);
        await expect(page.getByRole('button', { name: 'العربية' })).toBeVisible();
        await tapOutside(page, touch);
        await expect(page.getByRole('button', { name: 'العربية' })).toHaveCount(0);
      }
    });
  });
}
