/** Controls (brief B3): the owner sets the branch's limits and rules on one page; every change is a line in the audit
 * trail with the old and new value. The front desk has no Controls row. */
import { createOwner, createStaff } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, snap, staffOn, tab, text } from './support/ui';

test('the owner raises the discount limit and turns off blind count; both are audited', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-controls').click();
  await expect(id(page, 'controls-discount')).toHaveValue('10');
  await expect(id(page, 'controls-save')).toBeDisabled(); // nothing changed yet

  await id(page, 'controls-discount').fill('101');
  await expect(text(page, 'Use a number from 0 to 100.')).toBeVisible();
  await expect(id(page, 'controls-save')).toBeDisabled();
  await id(page, 'controls-discount').fill('15');
  await id(page, 'controls-blind').click();
  await snap(page, 'controls', mode);
  await id(page, 'controls-save').click();
  await expect(text(page, 'Controls saved')).toBeVisible();

  const saved = await owner.client.rpc('branch_controls', { p_branch: owner.branchId });
  if (saved.error) throw saved.error;
  expect(saved.data).toMatchObject({ discount_limit_bps: 1500, blind_count: false });
  const audit = await owner.client
    .from('audit_log')
    .select('summary')
    .eq('branch_id', owner.branchId)
    .eq('entity_type', 'control')
    .order('summary');
  if (audit.error) throw audit.error;
  expect(audit.data.map((r) => r.summary)).toEqual(['Controls: blind_count true → false', 'Controls: discount_limit_bps 1000 → 1500']);
});

test('the front desk has no Controls row', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const desk = await createStaff(owner, 'cashier');
  await staffOn(page, mode, owner.code, desk.username, desk.password);
  await tab(page, 'more');
  await expect(id(page, 'more-inventory')).toBeVisible();
  await expect(id(page, 'more-controls')).toHaveCount(0);
});
