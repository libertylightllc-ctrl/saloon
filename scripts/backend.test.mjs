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

test('refund RPC sends a tenant-scoped full refund request', async () => {
  const fixture = backendFixture([{ status: 200, body: { ok: true } }]);
  fixture.values.set('salon-control-session', JSON.stringify({ access_token: 'session-token' }));
  const refund = { id: 'refund-1', saleId: 'sale-1', amount: 15, payment: 'Cash', reason: 'Customer complaint' };
  await fixture.backend.refundSale('shop-id', refund);
  assert.match(fixture.calls[0].url, /rpc\/salon_refund_sale$/);
  assert.deepEqual(JSON.parse(fixture.calls[0].options.body), {
    target_shop: 'shop-id', refund_external_id: 'refund-1', sale_external_id: 'sale-1', refund_data: refund
  });
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
