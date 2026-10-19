/**
 * A staff member sells in their own name only, and can send a receipt again (owner, 2026-10-19): at checkout a barber
 * sees just themselves; the sale is theirs; after "New sale" they find it under More → My sales and send it on
 * WhatsApp again. The owner can resend any sale's receipt the same way.
 */
import type { Page } from '@playwright/test';

import { admin, createOwner, createStaff, latestSale } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { id, ownerOn, staffOn, tab } from './support/ui';

/** Taps "Send on WhatsApp" and returns the message WhatsApp would open with (the test answers for wa.me). */
async function whatsappText(page: Page, testId: string): Promise<string> {
  await page.context().route(/^https:\/\/wa\.me\//, (route) => route.fulfill({ contentType: 'text/plain', body: 'WhatsApp' }));
  const [popup] = await Promise.all([page.waitForEvent('popup'), id(page, testId).click()]);
  await popup.waitForLoadState();
  const text = new URL(popup.url()).searchParams.get('text') ?? '';
  await popup.close();
  return text;
}

test('a barber sells in their own name only, then sends the receipt again from My sales', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  await owner.client.rpc('update_branch', { p_branch: owner.branchId, p: { settings: { staff_can_sell: true } } });
  const me = await createStaff(owner, 'staff');
  const other = await createStaff(owner, 'staff');
  const svc = SERVICE[mode];

  await staffOn(page, mode, owner.code, me.username, me.password);
  await tab(page, 'sale');
  await id(page, `tile-${svc.name}-add`).click();
  await id(page, 'checkout').click();
  // Only themselves, already chosen.
  await expect(id(page, `checkout-staff-${me.name}`)).toHaveAttribute('aria-selected', 'true');
  await expect(id(page, `checkout-staff-${other.name}`)).toHaveCount(0);
  await id(page, 'save-sale').click();
  await expect(id(page, 'sale-done')).toBeVisible();
  const sale = await latestSale(owner.branchId);
  const { data: staff } = await admin.from('employees').select('id').eq('member_id', me.memberId).single();
  expect(sale).toMatchObject({ employee_id: staff!.id });
  await id(page, 'new-sale').click();

  // The customer did not get it: More → My sales → the sale → Send on WhatsApp.
  await tab(page, 'more');
  await id(page, 'more-mySales').click();
  await id(page, `sale-row-${sale.number}`).click();
  const text = await whatsappText(page, 'sale-whatsapp');
  expect(text).toContain(svc.name);
  expect(text).toMatch(/https:\/\/www\.saloqo\.com\/r\/[A-Za-z0-9_-]{24}/);

  // The owner can resend any sale's receipt too.
  const office = await device();
  await ownerOn(office, mode, owner.email, owner.password);
  await office.goto(`/sales`);
  await id(office, `sale-row-${sale.number}`).click();
  expect(await whatsappText(office, 'sale-whatsapp')).toContain(svc.name);
});
