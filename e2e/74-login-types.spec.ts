/** Login types in the browser (brief B2, B5, B8; Part B step 10): the front desk's discount above the limit needs the
 * owner's or a manager's PIN on the same device (a wrong PIN is refused); the manager's menu; a page the login may
 * not open says so. */
import { createOwner, createStaff, latestSale } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { id, snap, staffOn, tab, text } from './support/ui';

test('a front-desk discount above the limit goes through only with the owner’s PIN', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const pin = await owner.client.rpc('set_my_pin', { p_business: owner.businessId, p_pin: '2468' });
  if (pin.error) throw pin.error;
  const desk = await createStaff(owner, 'cashier');
  const svc = SERVICE[mode];
  const discount = svc.price / 4; // 25%, above the 10% limit

  await staffOn(page, mode, owner.code, desk.username, desk.password);
  await tab(page, 'sale');
  await id(page, `tile-${svc.name}-add`).click();
  await id(page, 'checkout').click();
  await id(page, 'discount').pressSequentially((discount / 100).toFixed(2));
  await id(page, 'save-sale').click();

  await expect(id(page, 'approval-title')).toHaveText('Manager approval needed');
  await expect(id(page, 'approval-summary')).toHaveText('Discount 25% (limit 10%)');
  await id(page, `approver-${owner.name}`).click();
  await id(page, 'approval-pin').fill('1111');
  await id(page, 'approval-approve').click();
  await expect(id(page, 'approval-error')).toBeVisible();
  await expect(id(page, 'sale-done')).toHaveCount(0);
  await snap(page, 'approval-wrong-pin', mode);

  await id(page, 'approval-pin').fill('2468');
  await id(page, 'approval-approve').click();
  await expect(id(page, 'sale-done')).toBeVisible();

  const sale = await latestSale(owner.branchId);
  expect(sale.discount_minor).toBe(discount);
  const approval = await owner.client.from('approvals').select('action, approved_name, requested_name, used_at').eq('branch_id', owner.branchId);
  if (approval.error) throw approval.error;
  expect(approval.data).toHaveLength(1);
  expect(approval.data[0]).toMatchObject({ action: 'discount', approved_name: owner.name, requested_name: desk.name });
  expect(approval.data[0]!.used_at).not.toBeNull();
});

test('a manager’s menu runs the day without payroll, plan or controls', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const manager = await createStaff(owner, 'cashier', { name: 'Mona Manager' });
  const promoted = await owner.client.rpc('set_login_type', { p_member: manager.memberId, p_role: 'manager' });
  if (promoted.error) throw promoted.error;

  await staffOn(page, mode, owner.code, manager.username, manager.password);
  for (const t of ['index', 'queue', 'sale', 'customers', 'closing-tab', 'more']) await expect(id(page, `tab-${t}`)).toBeVisible();
  await tab(page, 'more');
  for (const row of ['staff', 'inventory', 'purchases', 'compliance', 'approvals', 'reports']) {
    await expect(id(page, `more-${row}`)).toBeVisible();
  }
  for (const row of ['payroll', 'plan', 'controls', 'branch', 'accounts', 'backup']) await expect(id(page, `more-${row}`)).toHaveCount(0);
  await snap(page, 'more-manager', mode);
});

test('a page the login may not open says so', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const desk = await createStaff(owner, 'cashier');
  await staffOn(page, mode, owner.code, desk.username, desk.password);
  await expect(id(page, 'tab-index')).toBeVisible();
  await page.goto('/settings/controls');
  await expect(id(page, 'no-access')).toBeVisible();
  await expect(id(page, 'no-access')).toContainText("You don't have access to this page");
  await expect(text(page, 'No access')).toBeVisible(); // the header, short enough for a phone
  await expect(id(page, 'controls-save')).toHaveCount(0);
  await id(page, 'no-access-home').click();
  await expect(id(page, 'tab-index')).toBeVisible();
});
