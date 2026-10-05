/** Every compliance item can be edited and deleted (owner, 2026-10-05): from a row's "⋯" the owner adds the trade
 * licence, corrects its number in place (no new version), deletes it from its page with a reason, finds it under Removed
 * and puts it back with its details; an empty checklist item is deleted from its row's "⋯". */
import { admin, createOwner, createStaff, dubaiDate } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap, tab, text } from './support/ui';

test('owner edits and deletes compliance items, and puts one back', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const barber = await createStaff(owner, 'staff');
  const branch = `E2E ${mode} branch`;
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-compliance').click();
  await expect(id(page, 'compliance-readiness-value')).toHaveText('0%');

  // From the row's ⋯: add the trade licence.
  await id(page, `doc-menu-trade_licence-${branch}`).click();
  await id(page, 'doc-action-add').click();
  await id(page, 'doc-number').fill('CN-1234');
  await id(page, 'doc-expires').fill(dubaiDate(200));
  await id(page, 'doc-save').click();
  await expect(text(page, 'Saved', true)).toBeVisible();
  await expect(id(page, `doc-trade_licence-${branch}`)).toContainText('CN-1234');

  // Edit: the number is corrected in place — still version 1, no new version.
  await id(page, `doc-menu-trade_licence-${branch}`).click();
  await snap(page, 'compliance-item-menu', mode);
  await id(page, 'doc-action-edit').click();
  await expect(id(page, 'doc-number')).toHaveValue('CN-1234');
  await id(page, 'doc-number').fill('CN-12345');
  await id(page, 'doc-save').click();
  await expect(text(page, 'Changes saved')).toBeVisible();
  await expect(id(page, `doc-trade_licence-${branch}`)).toContainText('CN-12345');
  const { data: docs } = await admin
    .from('compliance_documents')
    .select('number, version, active')
    .eq('business_id', owner.businessId)
    .eq('doc_type', 'trade_licence');
  expect(docs).toEqual([{ number: 'CN-12345', version: 1, active: true }]);

  // Delete it from its page, with a reason: it leaves the register and is listed under Removed.
  await id(page, `doc-trade_licence-${branch}`).click();
  await id(page, 'doc-delete').click();
  await id(page, 'doc-delete-reason').fill('Held by the head office');
  await id(page, 'doc-delete-confirm').click();
  await expect(text(page, 'Deleted from the register')).toBeVisible();
  await expect(id(page, `doc-trade_licence-${branch}`)).toHaveCount(0);
  await expect(id(page, `removed-trade_licence-${branch}`)).toContainText('Held by the head office');

  // An empty checklist item — the barber's vaccination record — deleted from its ⋯.
  await id(page, `doc-menu-vaccination-${barber.name}`).click();
  await id(page, 'doc-action-delete').click();
  await id(page, 'doc-delete-confirm').click();
  await expect(id(page, `doc-vaccination-${barber.name}`)).toHaveCount(0);
  await expect(id(page, `removed-vaccination-${barber.name}`)).toBeVisible();
  await snap(page, 'compliance-removed', mode);

  // Put the licence back: it returns with its details.
  await id(page, `restore-trade_licence-${branch}`).click();
  await expect(text(page, 'Back on the register')).toBeVisible();
  await expect(id(page, `doc-trade_licence-${branch}`)).toContainText('CN-12345');
  await expect(id(page, `removed-trade_licence-${branch}`)).toHaveCount(0);
});
