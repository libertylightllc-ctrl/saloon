/** Reports by login type (brief B2 "Reports and books", B5 Approvals): a manager's reports have no books' figures,
 * customer list or VAT, and include no-shows; owner and manager read the Approvals list; a stylist sees only their
 * own line of staff sales, and their tips today on Home (brief B8). */
import { createOwner, createStaff, refundSale, sellService } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { id, snap, staffOn, tab } from './support/ui';

test('a manager reads sales without the books, the no-shows report and the Approvals list', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const manager = await createStaff(owner, 'cashier', { name: 'Mona Manager' });
  const promoted = await owner.client.rpc('set_login_type', { p_member: manager.memberId, p_role: 'manager' });
  if (promoted.error) throw promoted.error;
  const sale = await sellService(owner.client, owner, SERVICE[mode].name);
  await refundSale(owner, sale.sale_id, 1_000); // the owner's own refund is listed in Approvals with its reason

  await staffOn(page, mode, owner.code, manager.username, manager.password);
  await tab(page, 'more');
  await id(page, 'more-reports').click();
  await expect(id(page, 'report-type-no_shows')).toBeVisible();
  await expect(id(page, 'report-type-customers')).toHaveCount(0);
  await expect(id(page, 'report-type-vat')).toHaveCount(0);
  await expect(id(page, 'report-kpi-sales')).toBeVisible();
  await expect(id(page, 'report-kpi-revenue')).toHaveCount(0);
  await expect(id(page, 'report-kpi-result')).toHaveCount(0);
  await snap(page, 'reports-manager', mode);

  await id(page, 'report-type-no_shows').click();
  await expect(id(page, 'report-kpi-count')).toContainText('0');

  await id(page, 'reports-approvals').click();
  await expect(id(page, 'approvals-count')).toHaveText('1 approval');
  await expect(id(page, 'approval-refund')).toContainText('Refund AED 10.00');
  await expect(id(page, 'approval-refund')).toContainText(`By ${owner.name}, with a reason`);
  await expect(id(page, 'approval-refund')).toContainText('Reason: Test refund');
  await snap(page, 'approvals-list', mode);
});

test('a stylist sees their tips on Home and only their own line of staff sales', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const me = await createStaff(owner, 'staff', { name: 'Sara Stylist' });
  await createStaff(owner, 'staff', { name: 'Omar Other' });
  // The owner rings up a custom service for Sara with a 15.00 tip for her.
  const emp = await owner.client.from('employees').select('id').eq('member_id', me.memberId).single();
  if (emp.error) throw emp.error;
  const sale = await owner.client.rpc('create_sale', {
    p: {
      branch_id: owner.branchId,
      client_ref: crypto.randomUUID(),
      employee_id: emp.data.id,
      tip_minor: 1500,
      tip_employee_id: emp.data.id,
      lines: [{ kind: 'custom', name: 'Blow dry', unit_price_minor: 8000, employee_id: emp.data.id }],
      payments: [{ method: 'cash', amount_minor: 9500 }],
    },
  });
  if (sale.error) throw sale.error;

  await staffOn(page, mode, owner.code, me.username, me.password);
  await expect(id(page, 'kpi-my-tips')).toContainText('15.00');
  await tab(page, 'more');
  await id(page, 'more-myReport').click();
  await expect(id(page, 'report-table')).toContainText('Sara Stylist');
  await expect(id(page, 'report-table')).not.toContainText('Omar Other');
  await expect(id(page, 'report-type-staff')).toHaveCount(0); // one report, no picker
  await expect(id(page, 'reports-approvals')).toHaveCount(0);
});
