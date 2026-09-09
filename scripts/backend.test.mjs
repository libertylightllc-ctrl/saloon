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
