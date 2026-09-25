import { admin, createOwner, createStaff, sellService, staffEmail, userClient } from './support/api';
import { SERVICE } from './support/catalog';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { field, id, ownerOn, tab, text } from './support/ui';

test('one salon never sees or changes another salon’s data', async ({ page, mode }) => {
  const a = await createOwner(mode);
  const b = await createOwner(mode);
  const secret = `Secret ${uid().slice(-4)}`;
  await b.client.from('customers').insert({ business_id: b.businessId, name: secret, phone: '+971 55 000 0000' });
  const bSale = await sellService(b.client, b, SERVICE[mode].name);
  const bCashier = await createStaff(b, 'cashier');
  const { data: bService } = await admin.from('services').select('id').eq('business_id', b.businessId).limit(1).single();

  // Reads come back empty.
  const reads = await Promise.all([
    a.client.from('customers').select('id').eq('business_id', b.businessId),
    a.client.from('sales').select('id').eq('branch_id', b.branchId),
    a.client.from('appointments').select('id').eq('branch_id', b.branchId),
    a.client.from('services').select('id').eq('business_id', b.businessId),
    a.client.from('members').select('id').eq('business_id', b.businessId),
    a.client.from('journal_entries').select('id').eq('business_id', b.businessId),
    a.client.from('audit_log').select('id').eq('business_id', b.businessId),
  ]);
  for (const r of reads) expect(r.data ?? []).toHaveLength(0);

  // Writes and RPCs are refused.
  const { data: updated } = await a.client.from('services').update({ price_minor: 1 }).eq('id', bService!.id).select('id');
  expect(updated ?? []).toHaveLength(0);
  const walkIn = await a.client.rpc('create_appointment', { p: { branch_id: b.branchId, kind: 'walk_in', service_ids: [] } });
  expect(walkIn.error?.message).toMatch(/not_allowed/);
  const sale = await a.client.rpc('create_sale', {
    p: { branch_id: b.branchId, client_ref: crypto.randomUUID(), lines: [{ kind: 'custom', name: 'X', unit_price_minor: 100 }], payments: [{ method: 'cash', amount_minor: 100 }] },
  });
  expect(sale.error?.message).toMatch(/not_allowed/);
  const refund = await a.client.rpc('refund_sale', {
    p: { sale_id: bSale.sale_id, amount_minor: 100, method: 'cash', reason: 'Nope', idempotency_key: crypto.randomUUID() },
  });
  expect(refund.error?.message).toMatch(/not_allowed|not_found/);
  const dash = await a.client.rpc('dashboard_today', { p_branch: b.branchId });
  expect(dash.error?.message).toMatch(/not_allowed/);
  const login = await a.client.functions.invoke('create-staff-login', {
    body: { business_id: b.businessId, branch_id: b.branchId, display_name: 'Spy', username: `spy${uid().slice(-5)}`, password: 'Spy12345!', role: 'cashier' },
  });
  expect(login.error).toBeTruthy();
  // B's cashier cannot see A's business either.
  const bCashierApi = await userClient(staffEmail(b.code, bCashier.username), bCashier.password);
  const { data: crossRead } = await bCashierApi.from('customers').select('id').eq('business_id', a.businessId);
  expect(crossRead ?? []).toHaveLength(0);

  // In the app: A's search does not find B's customer, and B's staff cannot sign in with A's code.
  await ownerOn(page, mode, a.email, a.password);
  await tab(page, 'customers');
  await id(page, 'customers-search').fill(secret);
  await expect(text(page, 'No customer matches that search.')).toBeVisible();
  await tab(page, 'more');
  await id(page, 'sign-out').click();
  // Signed out for good: a reload stays on the sign-in.
  await expect(id(page, 'sign-in-submit')).toBeVisible();
  await page.reload();
  await id(page, 'sign-in-as-staff').click();
  await field(page, 'salonCode').fill(a.code);
  await field(page, 'username').fill(bCashier.username);
  await field(page, 'password').fill(bCashier.password);
  await id(page, 'sign-in-submit').click();
  await expect(id(page, 'form-error')).toContainText('Wrong email, username or password.');
});
