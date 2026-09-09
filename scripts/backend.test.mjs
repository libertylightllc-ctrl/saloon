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
