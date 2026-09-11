import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const auth = source.slice(source.indexOf('function authenticateLogin('), source.indexOf('function openAccessHelpDialog('));
const normalizer = source.slice(source.indexOf('function removeLegacyDemoRows('), source.indexOf('function saveState('));
function fixture() {
  const context = vm.createContext({
    platformAccount: { shopCode: 'PLATFORM', username: 'admin', password: 'platform-password', role: 'Platform Admin' },
    activeShopId: 'shop-a',
    shops: [{ id: 'shop-a', shopCode: 'ALBARSHA001', enabled: true }],
    roleAccess: { Owner: [], Staff: [], Cashier: [], 'Master Admin': [], 'Platform Admin': [] },
    shopStates: { 'shop-a': { users: [
      { username: 'owner.albarsha', password: ' changed password ', role: 'Owner', active: true },
      { username: 'staff', password: 'staff-password', role: 'Staff', active: true }
    ] } }
  });
  vm.runInContext(auth, context);
  return context;
}
test('role comes from the stored account, not caller input', () => {
  const ctx = fixture();
  const result = ctx.authenticateLogin({ shopCode: 'albarsha001', username: 'STAFF', password: 'staff-password', role: 'Platform Admin' });
  assert.equal(result.role, 'Staff');
});
test('old owner PIN cannot reset a changed password or reactivate an account', () => {
  const ctx = fixture();
  const owner = ctx.shopStates['shop-a'].users[0];
  assert.equal(ctx.authenticateLogin({ shopCode: 'ALBARSHA001', username: 'owner.albarsha', password: '1234' }).ok, false);
  assert.equal(owner.password, ' changed password ');
  owner.active = false;
  assert.equal(ctx.authenticateLogin({ shopCode: 'ALBARSHA001', username: 'owner.albarsha', password: owner.password }).ok, false);
  assert.equal(owner.active, false);
});
test('password whitespace is meaningful; suspended shops cannot sign in', () => {
  const ctx = fixture();
  const input = { shopCode: 'ALBARSHA001', username: 'owner.albarsha', password: ' changed password ' };
  assert.equal(ctx.authenticateLogin(input).ok, true);
  assert.equal(ctx.authenticateLogin({ ...input, password: input.password.trim() }).ok, false);
  ctx.shops[0].enabled = false;
  assert.equal(ctx.authenticateLogin(input).ok, false);
});
test('login normalization preserves records that resemble demo transactions', () => {
  const data = {
    sales: [{ service: 'Haircut', staff: 'Rafiq', amount: 25 }],
    purchases: [{ supplier: 'Beauty Supply LLC', item: 'Blades, foam, tissues', unitCost: 420 }],
    expenses: [{ category: 'Tea & Food', amount: 35, note: 'Tea and water for staff' }],
    auditLog: [{ detail: 'Owner · Tea & Food · AED 35 · Cash' }],
    hygieneLogs: [{ cycle: '44 blades counted' }],
    inspectionRecords: [], documentChain: [], complianceDocuments: [], montajiItems: [],
    ensureComplianceDocumentsForCountry() {}
  };
  const before = JSON.stringify(data);
  const ctx = vm.createContext(data);
  vm.runInContext(normalizer + '\nremoveLegacyDemoRows();', ctx);
  assert.equal(JSON.stringify(data), before);
});
