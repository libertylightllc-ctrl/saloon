import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('../backend.js', import.meta.url), 'utf8');

function backendFixture(responses = []) {
  const values = new Map();
  const calls = [];
  const context = vm.createContext({
    window: {},
    sessionStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const response = responses.shift() || { status: 200, body: [] };
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        json: async () => response.body
      };
    },
    encodeURIComponent,
    setTimeout,
    clearTimeout
  });
  vm.runInContext(source, context);
  return { backend: context.window.SalonBackend, calls, values };
}

test('browser bundle contains only the publishable key', () => {
  assert.match(source, /sb_publishable_/);
  assert.doesNotMatch(source, /sb_secret_|service_role/);
});

test('login ID maps to a private auth email and role comes from the server', async () => {
  const fixture = backendFixture([
    { status: 200, body: { access_token: 'session-token', refresh_token: 'refresh-token' } },
    { status: 200, body: [{ shop_code: 'ALBARSHA001', role: 'staff', shop_id: 'shop-id' }] }
  ]);
  const result = await fixture.backend.signIn('ALBARSHA001', 'Staff.One', 'password');
  assert.equal(result.identity.role, 'staff');
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    email: 'albarsha001.staff.one@auth.saloncontrol.app',
    password: 'password'
  });
  assert.match(fixture.calls[1].options.headers.Authorization, /^Bearer session-token$/);
});

test('login rejects a valid account assigned to another shop', async () => {
  const fixture = backendFixture([
    { status: 200, body: { access_token: 'session-token' } },
    { status: 200, body: [{ shop_code: 'SHOP_B', role: 'owner', shop_id: 'shop-b' }] }
  ]);
  await assert.rejects(fixture.backend.signIn('SHOP_A', 'owner', 'password'), /not assigned/);
  assert.equal(fixture.values.has('salon-control-session'), false);
});

test('cloud deletions use a tenant-scoped soft delete', async () => {
  const fixture = backendFixture([{ status: 204, body: null }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  await fixture.backend.softDeleteRecord('shop-id', 'purchase', 'purchase-1');
  assert.match(fixture.calls[0].url, /shop_id=eq\.shop-id/);
  assert.match(fixture.calls[0].url, /record_type=eq\.purchase/);
  assert.equal(fixture.calls[0].options.method, 'PATCH');
  assert.ok(JSON.parse(fixture.calls[0].options.body).deleted_at);
});

test('stored evidence paths receive fresh private links', async () => {
  const fixture = backendFixture([{ status: 200, body: { signedURL: '/object/sign/salon-documents/token' } }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const url = await fixture.backend.signEvidence('shop-id/folder/invoice 1.pdf');
  assert.match(fixture.calls[0].url, /shop-id\/folder\/invoice%201\.pdf$/);
  assert.equal(url, 'https://vmoocchjtlpggnoadpio.supabase.co/storage/v1/object/sign/salon-documents/token');
});

test('sale RPC sends one tenant-scoped transaction with stock usage', async () => {
  const fixture = backendFixture([{ status: 200, body: { ok: true } }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const sale = { id: 'sale-1', service: 'Shave', amount: 15 };
  const usage = [{ itemId: 'inv-blades', quantity: 1 }];
  await fixture.backend.recordSale('shop-id', sale, usage);
  assert.match(fixture.calls[0].url, /rpc\/salon_record_sale$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    target_shop: 'shop-id', sale_external_id: 'sale-1', sale_data: sale, stock_usage: usage
  });
});

test('refund RPC sends a tenant-scoped controlled refund request', async () => {
  const fixture = backendFixture([{ status: 200, body: { ok: true } }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const refund = { id: 'refund-1', saleId: 'sale-1', amount: 15, payment: 'Cash', reason: 'Customer complaint' };
  await fixture.backend.refundSale('shop-id', refund);
  assert.match(fixture.calls[0].url, /rpc\/salon_refund_sale$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    target_shop: 'shop-id', refund_external_id: 'refund-1', sale_external_id: 'sale-1', refund_data: refund
  });
});

test('expense creation and reversal use controlled RPCs', async () => {
  const fixture = backendFixture([{ status: 200, body: { ok: true } }, { status: 200, body: { ok: true } }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const expense = { id: 'expense-1', category: 'Tea & Food', amount: 20, payment: 'Cash', note: 'Team tea' };
  await fixture.backend.recordExpense('shop-id', expense);
  await fixture.backend.reverseExpense('shop-id', expense.id, 'Duplicate entry');
  assert.match(fixture.calls[0].url, /rpc\/salon_record_expense$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { target_shop: 'shop-id', expense_external_id: 'expense-1', expense_data: expense });
  assert.match(fixture.calls[1].url, /rpc\/salon_reverse_expense$/);
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { target_shop: 'shop-id', expense_external_id: 'expense-1', reversal_reason: 'Duplicate entry' });
});

test('purchase creation and reversal use controlled stock RPCs', async () => {
  const fixture = backendFixture([{ status: 200, body: { ok: true } }, { status: 200, body: { ok: true } }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const purchase = { id: 'purchase-1', supplierId: 'supplier-1', item: 'Tissues', qty: 10, unitCost: 2 };
  const inventory = { id: 'inv-tissues', name: 'Tissues', unit: 'pcs' };
  await fixture.backend.recordPurchase('shop-id', purchase, inventory);
  await fixture.backend.reversePurchase('shop-id', purchase.id, 'Duplicate bill');
  assert.match(fixture.calls[0].url, /rpc\/salon_record_purchase$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    target_shop: 'shop-id', purchase_external_id: 'purchase-1', purchase_data: purchase, inventory_data: inventory
  });
  assert.match(fixture.calls[1].url, /rpc\/salon_reverse_purchase$/);
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), {
    target_shop: 'shop-id', purchase_external_id: 'purchase-1', reversal_reason: 'Duplicate bill'
  });
});

test('supplier payment creation and reversal use controlled RPCs', async () => {
  const fixture = backendFixture([{ status: 200, body: { ok: true } }, { status: 200, body: { ok: true } }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const payment = { id: 'payment-1', supplierId: 'supplier-1', amount: 20, payment: 'Cash' };
  await fixture.backend.recordSupplierPayment('shop-id', payment);
  await fixture.backend.reverseSupplierPayment('shop-id', payment.id, 'Duplicate payment');
  assert.match(fixture.calls[0].url, /rpc\/salon_record_supplier_payment$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    target_shop: 'shop-id', payment_external_id: 'payment-1', payment_data: payment
  });
  assert.match(fixture.calls[1].url, /rpc\/salon_reverse_supplier_payment$/);
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), {
    target_shop: 'shop-id', payment_external_id: 'payment-1', reversal_reason: 'Duplicate payment'
  });
});

test('inventory master, movement and archive use controlled RPCs', async () => {
  const fixture = backendFixture([
    { status: 200, body: { ok: true } }, { status: 200, body: { ok: true } }, { status: 200, body: { ok: true } }
  ]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const item = { id: 'inv-1', name: 'Towels', quantity: 10 };
  await fixture.backend.saveInventoryItem('shop-id', item, 'movement-1', 'Opening count');
  await fixture.backend.recordStockMovement('shop-id', 'movement-2', item.id, 'waste', 2, 'Damaged stock');
  await fixture.backend.archiveInventoryItem('shop-id', item.id, 'Item retired');
  assert.match(fixture.calls[0].url, /rpc\/salon_save_inventory_item$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { target_shop:'shop-id', item_external_id:'inv-1', change_external_id:'movement-1', item_data:item, change_reason:'Opening count' });
  assert.match(fixture.calls[1].url, /rpc\/salon_record_stock_movement$/);
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { target_shop:'shop-id', movement_external_id:'movement-2', item_external_id:'inv-1', movement_type:'waste', entered_quantity:2, movement_reason:'Damaged stock' });
  assert.match(fixture.calls[2].url, /rpc\/salon_archive_inventory_item$/);
  assert.deepEqual(JSON.parse(fixture.calls[2].options.body), { target_shop:'shop-id', item_external_id:'inv-1', archive_reason:'Item retired' });
});

test('service and supplier master data use controlled RPCs', async () => {
  const fixture = backendFixture([
    { status: 200, body: { ok: true } }, { status: 200, body: { ok: true } },
    { status: 200, body: { ok: true } }, { status: 200, body: { ok: true } }
  ]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const service = { id: 'service-1', name: 'Haircut', category: 'Hair', price: 35 };
  const supplier = { id: 'supplier-1', name: 'Grooming Supply', termsDays: 30 };
  await fixture.backend.saveService('shop-id', service, 'Price review');
  await fixture.backend.archiveService('shop-id', service.id, 'Service retired');
  await fixture.backend.saveSupplier('shop-id', supplier, 'Terms updated');
  await fixture.backend.archiveSupplier('shop-id', supplier.id, 'Supplier retired');
  assert.match(fixture.calls[0].url, /rpc\/salon_save_service$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { target_shop:'shop-id', service_external_id:'service-1', service_data:service, change_reason:'Price review' });
  assert.match(fixture.calls[1].url, /rpc\/salon_archive_service$/);
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { target_shop:'shop-id', service_external_id:'service-1', archive_reason:'Service retired' });
  assert.match(fixture.calls[2].url, /rpc\/salon_save_supplier$/);
  assert.deepEqual(JSON.parse(fixture.calls[2].options.body), { target_shop:'shop-id', supplier_external_id:'supplier-1', supplier_data:supplier, change_reason:'Terms updated' });
  assert.match(fixture.calls[3].url, /rpc\/salon_archive_supplier$/);
  assert.deepEqual(JSON.parse(fixture.calls[3].options.body), { target_shop:'shop-id', supplier_external_id:'supplier-1', archive_reason:'Supplier retired' });
});

test('customer and booking lifecycle use controlled RPCs', async () => {
  const fixture = backendFixture([
    { status: 200, body: { ok: true } }, { status: 200, body: { ok: true } }, { status: 200, body: { ok: true } }
  ]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const customer = { id:'customer-1', name:'Hassan', phone:'0501234567' };
  const ticket = { id:'ticket-1', customerId:customer.id, serviceId:'service-1', type:'Appointment', deposit:20 };
  await fixture.backend.saveCustomer('shop-id', customer);
  await fixture.backend.recordBooking('shop-id', ticket);
  await fixture.backend.updateBookingStatus('shop-id', ticket.id, 'Cancelled', 'Customer requested');
  assert.match(fixture.calls[0].url, /rpc\/salon_save_customer$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { target_shop:'shop-id', customer_external_id:'customer-1', customer_data:customer });
  assert.match(fixture.calls[1].url, /rpc\/salon_record_booking$/);
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { target_shop:'shop-id', ticket_external_id:'ticket-1', ticket_data:ticket });
  assert.match(fixture.calls[2].url, /rpc\/salon_update_booking_status$/);
  assert.deepEqual(JSON.parse(fixture.calls[2].options.body), { target_shop:'shop-id', ticket_external_id:'ticket-1', next_status:'Cancelled', action_reason:'Customer requested' });
});

test('staff, attendance and payroll lifecycle use controlled RPCs', async () => {
  const fixture = backendFixture(Array.from({ length: 6 }, () => ({ status: 200, body: { ok: true } })));
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const profile = { id:'profile-1', name:'Sameer', employeeNo:'EMP-001', baseSalary:3000 };
  const attendance = { id:'attendance-1', staffId:profile.id, date:'2026-09-11', status:'Present' };
  const adjustment = { id:'adjustment-1', staffId:profile.id, period:'2026-09', type:'Allowance', amount:100, reason:'Transport' };
  const payment = { method:'WPS', reference:'WPS-001', evidencePath:'shop-id/payroll/wps.pdf', evidenceName:'wps.pdf' };
  await fixture.backend.saveStaffProfile('shop-id', profile, 'Salary review');
  await fixture.backend.archiveStaffProfile('shop-id', profile.id, 'Employment ended');
  await fixture.backend.saveAttendance('shop-id', attendance, 'Clock-out correction');
  await fixture.backend.recordStaffAdjustment('shop-id', adjustment);
  await fixture.backend.generatePayroll('shop-id', '2026-09');
  await fixture.backend.payPayroll('shop-id', 'payroll-1', payment);
  assert.match(fixture.calls[0].url, /rpc\/salon_save_staff_profile$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { target_shop:'shop-id', profile_external_id:'profile-1', profile_data:profile, change_reason:'Salary review' });
  assert.match(fixture.calls[1].url, /rpc\/salon_archive_staff_profile$/);
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { target_shop:'shop-id', profile_external_id:'profile-1', archive_reason:'Employment ended' });
  assert.match(fixture.calls[2].url, /rpc\/salon_save_attendance$/);
  assert.deepEqual(JSON.parse(fixture.calls[2].options.body), { target_shop:'shop-id', attendance_external_id:'attendance-1', attendance_data:attendance, change_reason:'Clock-out correction' });
  assert.match(fixture.calls[3].url, /rpc\/salon_record_staff_adjustment$/);
  assert.deepEqual(JSON.parse(fixture.calls[3].options.body), { target_shop:'shop-id', adjustment_external_id:'adjustment-1', adjustment_data:adjustment });
  assert.match(fixture.calls[4].url, /rpc\/salon_generate_payroll$/);
  assert.deepEqual(JSON.parse(fixture.calls[4].options.body), { target_shop:'shop-id', target_period:'2026-09' });
  assert.match(fixture.calls[5].url, /rpc\/salon_pay_payroll$/);
  assert.deepEqual(JSON.parse(fixture.calls[5].options.body), { target_shop:'shop-id', payroll_external_id:'payroll-1', payment_data:payment });
});

test('compliance lifecycle uses controlled document, inspection and hygiene RPCs', async () => {
  const fixture = backendFixture(Array.from({ length: 6 }, () => ({ status: 200, body: { ok: true } })));
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const document = { id:'compliance-1', type:'Trade licence', holder:'Company', expiryDate:'2027-09-11' };
  const inspection = { id:'inspection-1', record:'Sterilizer cycle', evidence:'photo.jpg' };
  const log = { id:'hygiene-1', device:'Sterilizer', cycle:'Full cycle', evidence:'photo.jpg' };
  const product = { id:'product-1', name:'Hair Color', sku:'COLOR-01', status:'Verified', authorityReference:'MONT-01' };
  await fixture.backend.saveComplianceDocument('shop-id', document, 'Annual renewal');
  await fixture.backend.archiveComplianceDocument('shop-id', document.id, 'Replaced licence');
  await fixture.backend.signInspection('shop-id', inspection, 'Corrected evidence');
  await fixture.backend.recordHygieneLog('shop-id', log);
  await fixture.backend.saveProductRegistration('shop-id', product, 'Verification renewed');
  await fixture.backend.archiveProductRegistration('shop-id', product.id, 'Product discontinued');
  assert.match(fixture.calls[0].url, /rpc\/salon_save_compliance_document$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { target_shop:'shop-id', document_external_id:'compliance-1', document_data:document, change_reason:'Annual renewal' });
  assert.match(fixture.calls[1].url, /rpc\/salon_archive_compliance_document$/);
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { target_shop:'shop-id', document_external_id:'compliance-1', archive_reason:'Replaced licence' });
  assert.match(fixture.calls[2].url, /rpc\/salon_sign_inspection$/);
  assert.deepEqual(JSON.parse(fixture.calls[2].options.body), { target_shop:'shop-id', inspection_external_id:'inspection-1', inspection_data:inspection, change_reason:'Corrected evidence' });
  assert.match(fixture.calls[3].url, /rpc\/salon_record_hygiene_log$/);
  assert.deepEqual(JSON.parse(fixture.calls[3].options.body), { target_shop:'shop-id', log_external_id:'hygiene-1', log_data:log });
  assert.match(fixture.calls[4].url, /rpc\/salon_save_product_registration$/);
  assert.deepEqual(JSON.parse(fixture.calls[4].options.body), { target_shop:'shop-id', product_external_id:'product-1', product_data:product, change_reason:'Verification renewed' });
  assert.match(fixture.calls[5].url, /rpc\/salon_archive_product_registration$/);
  assert.deepEqual(JSON.parse(fixture.calls[5].options.body), { target_shop:'shop-id', product_external_id:'product-1', archive_reason:'Product discontinued' });
});

test('daily close RPC sends counted cash for server calculation', async () => {
  const fixture = backendFixture([{ status: 200, body: { ok: true } }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const closing = { id: 'closing-2026-09-10', businessDate: '2026-09-10', actual: 100, reason: '' };
  await fixture.backend.closeDay('shop-id', closing);
  assert.match(fixture.calls[0].url, /rpc\/salon_close_day$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    target_shop: 'shop-id', closing_external_id: closing.id, closing_data: closing
  });
});

test('accounting screen loads a server-generated tenant snapshot', async () => {
  const fixture = backendFixture([{ status: 200, body: { balanced: true, entries: [] } }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  await fixture.backend.loadAccountingSnapshot('shop-id');
  assert.match(fixture.calls[0].url, /rpc\/salon_accounting_snapshot$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { target_shop:'shop-id' });
});

test('cloud backup lifecycle uses tenant-scoped immutable snapshot RPCs', async () => {
  const fixture = backendFixture(Array.from({ length:3 }, () => ({ status:200, body:[] })));
  fixture.values.set('salon-control-session', JSON.stringify({ access_token:'session-token' }));
  await fixture.backend.createBackup('shop-id','Pre-launch snapshot');
  await fixture.backend.listBackups('shop-id');
  await fixture.backend.getBackup('shop-id','backup-id');
  assert.match(fixture.calls[0].url,/rpc\/salon_create_backup$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body),{ target_shop:'shop-id',backup_label:'Pre-launch snapshot' });
  assert.match(fixture.calls[1].url,/rpc\/salon_list_backups$/);
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body),{ target_shop:'shop-id' });
  assert.match(fixture.calls[2].url,/rpc\/salon_get_backup$/);
  assert.deepEqual(JSON.parse(fixture.calls[2].options.body),{ target_shop:'shop-id',backup_id:'backup-id' });
});

test('accounting period close and reopen use controlled RPCs', async () => {
  const fixture = backendFixture([{ status: 200, body: { ok: true } }, { status: 200, body: { ok: true } }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  await fixture.backend.closeAccountingPeriod('shop-id', '2026-08');
  await fixture.backend.reopenAccountingPeriod('shop-id', '2026-08', 'Approved correction');
  assert.match(fixture.calls[0].url, /rpc\/salon_close_accounting_period$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { target_shop: 'shop-id', target_period: '2026-08' });
  assert.match(fixture.calls[1].url, /rpc\/salon_reopen_accounting_period$/);
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { target_shop: 'shop-id', target_period: '2026-08', reopen_reason: 'Approved correction' });
});

test('login activity uses server-side record and history RPCs', async () => {
  const fixture = backendFixture([{ status: 200, body: { id: 1 } }, { status: 200, body: [] }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  await fixture.backend.recordLogin('shop-id');
  await fixture.backend.loadLoginHistory('shop-id');
  assert.match(fixture.calls[0].url, /rpc\/salon_record_login$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), { target_shop: 'shop-id' });
  assert.match(fixture.calls[1].url, /rpc\/salon_login_history$/);
  assert.deepEqual(JSON.parse(fixture.calls[1].options.body), { target_shop: 'shop-id' });
});

test('temporary credentials are detected and the authenticated user can replace them', async () => {
  const fixture = backendFixture([
    { status: 200, body: { access_token: 'session-token', refresh_token: 'refresh-token', user: { user_metadata: { must_change_password: true } } } },
    { status: 200, body: [{ shop_code: 'SHOP_A', role: 'cashier', shop_id: 'shop-id' }] },
    { status: 200, body: { id: 'user-id', user_metadata: { must_change_password: false } } }
  ]);
  const result = await fixture.backend.signIn('SHOP_A', 'cashier', 'Temporary10');
  assert.equal(result.mustChangePassword, true);
  await fixture.backend.changePassword('PrivatePass20');
  assert.match(fixture.calls[2].url, /auth\/v1\/user$/);
  assert.equal(fixture.calls[2].options.method, 'PUT');
  assert.deepEqual(JSON.parse(fixture.calls[2].options.body), {
    password: 'PrivatePass20', data: { must_change_password: false }
  });
  const stored = JSON.parse(fixture.values.get('salon-control-session'));
  assert.equal(stored.user.user_metadata.must_change_password, false);
});

test('expired API responses refresh the session once and retry', async () => {
  const fixture = backendFixture([
    { status: 401, body: { message: 'expired' } },
    { status: 200, body: { access_token: 'new-token', refresh_token: 'new-refresh' } },
    { status: 200, body: [] }
  ]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'old-token', refresh_token: 'refresh-token' }));
  await fixture.backend.loadShops();
  assert.match(fixture.calls[1].url, /grant_type=refresh_token/);
  assert.match(fixture.calls[2].options.headers.Authorization, /new-token/);
});
