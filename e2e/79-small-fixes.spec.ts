/** Owner's fix list, 16 Nov 2026: ten small items, each checked on screen with the login that reported it (item 3, the
 * tip on a refund, is 78-refund-tip). */
import { admin, createOwner, createStaff, employeeOf, type Owner } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { back, id, ownerOn, staffOn, tab, text } from './support/ui';

const dayIn = (timeZone: string, n = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(Date.now() + n * 86_400_000));

async function manager(owner: Owner) {
  const login = await createStaff(owner, 'cashier', { name: 'Mona Manager' });
  const { error } = await owner.client.rpc('set_login_type', { p_member: login.memberId, p_role: 'manager' });
  if (error) throw error;
  return login;
}

test('owner and manager: stock as Inventory counts it, the compliance line, salaries, Suppliers & bills, due today', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const { data: biz } = await admin.from('businesses').select('timezone').eq('id', owner.businessId).single();
  const today = dayIn(biz!.timezone);
  // An item sold with none in stock: below zero, so it needs a stock count (item 1).
  const { data: item, error } = await owner.client.rpc('save_item', {
    p: { business_id: owner.businessId, name: 'Fix Wax', kind: 'retail', unit: 'pcs', sell_price_minor: 2_000 },
  });
  if (error) throw error;
  const sold = await owner.client.rpc('create_sale', {
    p: {
      branch_id: owner.branchId,
      client_ref: crypto.randomUUID(),
      lines: [{ kind: 'retail', item_id: item, qty: 1 }],
      payments: [{ method: 'cash', amount_minor: 2_000 }],
    },
  });
  if (sold.error) throw sold.error;
  // A trade licence that expires today (item 2), and the morning job that sends the alert.
  const doc = await admin.from('compliance_documents').insert({
    business_id: owner.businessId, branch_id: owner.branchId, doc_type: 'trade_licence', holder_type: 'company', expires_on: today,
  });
  if (doc.error) throw doc.error;
  const due = await admin.rpc('notify_documents_due', { p_today: today });
  if (due.error) throw due.error;
  const mona = await manager(owner);

  await ownerOn(page, mode, owner.email, owner.password);
  // 1. Inventory's count, then the same number on Home and in the Control summary.
  await tab(page, 'more');
  await id(page, 'more-inventory').click();
  const counted = Number(await id(page, 'inventory-low-value').innerText());
  expect(counted).toBeGreaterThan(1);
  await back(page);
  await id(page, 'more-reports').click();
  await expect(id(page, 'report-control')).toContainText(`Low or out of stock: ${counted}`);
  await back(page);
  await tab(page, 'index');
  await expect(id(page, 'attention-low-stock')).toContainText(`${counted} items out of stock · 1 needs a stock count`);
  // 2. The bell: "Document due today", not "in 0 days".
  await id(page, 'home-bell').click();
  await expect(id(page, 'notification-document_due')).toContainText('Document due today');
  await expect(text(page, /due in 0 days/)).toHaveCount(0);
  await back(page);
  // 10. The page is named as the menu names it.
  await tab(page, 'more');
  await expect(id(page, 'more-purchases')).toContainText('Suppliers & bills');
  await id(page, 'more-purchases').click();
  await expect(page.getByRole('heading', { name: 'Suppliers & bills', exact: true })).toBeVisible();
  await back(page);
  // 6. The owner still sees salaries.
  await id(page, 'more-staff').click();
  await expect(id(page, `staff-salary-${mona.name}`)).toBeVisible();
  const ownerAttention = await (async () => {
    const { data } = await owner.client.rpc('dashboard_today', { p_branch: owner.branchId });
    return (data as { compliance: { attention: number } }).compliance.attention;
  })();

  // The manager: the compliance line (7), the stock line (1), no salary amounts (6).
  const phone = await device();
  await staffOn(phone, mode, owner.code, mona.username, mona.password);
  await expect(id(phone, 'attention-compliance')).toContainText(
    ownerAttention === 1 ? '1 compliance record needs attention' : `${ownerAttention} compliance records need attention`,
  );
  await expect(id(phone, 'attention-low-stock')).toContainText(`${counted} items out of stock · 1 needs a stock count`);
  await tab(phone, 'more');
  await id(phone, 'more-staff').click();
  await expect(id(phone, `staff-${mona.name}`)).toBeVisible();
  await expect(phone.locator('[data-testid^="staff-salary-"]')).toHaveCount(0);
  await expect(text(phone, /AED\s0\.00/)).toHaveCount(0);
  await id(phone, `staff-${mona.name}`).click();
  await expect(id(phone, 'staff-detail-commission')).toBeVisible();
  await expect(id(phone, 'staff-detail-salary')).toHaveCount(0);
  await back(phone);
  await back(phone);
  await expect(id(phone, 'more-purchases')).toContainText('Suppliers & bills');
  await id(phone, 'more-purchases').click();
  await expect(phone.getByRole('heading', { name: 'Suppliers & bills', exact: true })).toBeVisible();
});

test('front desk: Petty cash by name, a neutral example, Home today only', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const desk = await createStaff(owner, 'cashier');
  await staffOn(page, mode, owner.code, desk.username, desk.password);
  // 4c. No week of revenue; today's payment mix stays.
  await expect(text(page, 'Payment mix today')).toBeVisible();
  await expect(id(page, 'home-revenue-7d')).toHaveCount(0);
  await expect(text(page, 'Revenue · last 7 days')).toHaveCount(0);
  // 4a. The page opened from "Petty cash" is called Petty cash.
  await tab(page, 'more');
  await expect(id(page, 'more-expenses')).toContainText('Petty cash');
  await id(page, 'more-expenses').click();
  await expect(page.getByRole('heading', { name: 'Petty cash', exact: true })).toBeVisible();
  // 4b. The note's example is not a Dubai bill.
  await page.goto('/expenses/new');
  await expect(text(page, 'For example: electricity bill, tea and sugar, 3 uniforms')).toBeVisible();
  await expect(text(page, /DEWA/)).toHaveCount(0);
});

test('stylist: My bookings has their own clients, and the rest of the team only as busy or free', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const me = await createStaff(owner, 'staff', { name: 'Rana Mine' });
  const other = await createStaff(owner, 'staff', { name: 'Sara Other' });
  await createStaff(owner, 'staff', { name: 'Huda Free' });
  const { data: svc } = await admin.from('services').select('id').eq('business_id', owner.businessId).eq('name', SERVICE[mode].name).single();
  for (const [login, guest] of [[me, 'My Own Client'], [other, 'Secret Client']] as const) {
    const { error } = await owner.client.rpc('create_appointment', {
      p: { branch_id: owner.branchId, kind: 'walk_in', guest_name: guest, employee_id: await employeeOf(login.memberId), service_ids: [svc!.id] },
    });
    if (error) throw error;
  }

  await staffOn(page, mode, owner.code, me.username, me.password);
  await tab(page, 'queue');
  await expect(page.getByRole('heading', { name: 'My bookings', exact: true })).toBeVisible();
  await expect(text(page, 'My Own Client')).toBeVisible();
  await expect(text(page, 'Secret Client')).toHaveCount(0);
  // No filter listing every stylist: their names show only under "The rest of the team", as busy or free.
  await expect(id(page, 'team-times')).toContainText('The rest of the team');
  await expect(id(page, 'team-times-Sara Other')).toContainText(/Busy: \d{1,2}:\d\d( [AP]M)?–\d{1,2}:\d\d( [AP]M)?$/);
  await expect(id(page, 'team-times-Huda Free')).toContainText('Free all day');
  await expect(id(page, 'team-times-Rana Mine')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sara Other', exact: true })).toHaveCount(0);
});

test('accountant: the expected cash on Home, no Plan & billing', async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 25_000 });
  const books = await createStaff(owner, 'accountant');
  await staffOn(page, mode, owner.code, books.username, books.password);
  // 8. Blind count is for the front desk only.
  await expect(id(page, 'kpi-expected-cash-value')).toContainText('250.00');
  // 9. Plan & billing is the owner's: not in More, and closed by address.
  await tab(page, 'more');
  await expect(id(page, 'more-staff').or(id(page, 'more-reports')).first()).toBeVisible();
  await expect(id(page, 'more-plan')).toHaveCount(0);
  await page.goto('/plan');
  await expect(id(page, 'no-access')).toBeVisible();
});
