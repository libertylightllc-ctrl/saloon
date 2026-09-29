/**
 * Button sweep: every visible button on every screen (M1–M4), in both modes and for each role.
 * Each tap must do something the person can see — navigate, open a sheet, change the screen,
 * or show a validation message — never nothing, never a crash, never an unbuilt route, never a
 * permission error. Deliberately disabled buttons are listed with their state.
 * The report is written to docs/button-sweep/button-sweep-<mode>-<role>.md.
 */
import { mkdirSync, writeFileSync } from 'fs';

import type { Page } from '@playwright/test';

import { admin, createOwner, createStaff, sellService, type Mode, type Owner } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { id, ownerOn, staffOn } from './support/ui';

/** Covered by their own flows, and they end the session or change who can sign in. */
const SKIP: Record<string, string> = {
  'Sign out': 'flow 9',
  'Disable login': 'flow 9',
  'Enable login': 'flow 9',
};

interface Row {
  screen: string;
  button: string;
  result: string;
  ok: boolean;
}

const LIVE = ':not([aria-hidden="true"] *)';

/** Waits until the screen has loaded its data: network quiet and no loading placeholders. */
async function settle(page: Page) {
  await expect(page.locator(`[role="button"]${LIVE}, [role="tab"]${LIVE}`).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.locator(`[role="progressbar"]${LIVE}`)).toHaveCount(0, { timeout: 15_000 });
}

/** While a sheet is open only its own controls count (and the backdrop, labelled "Close"). */
async function visibleButtons(page: Page): Promise<{ name: string; disabled: boolean; selected: boolean }[]> {
  return page.evaluate((live) => {
    const dialogs = [...document.querySelectorAll('[aria-modal="true"]')] as HTMLElement[];
    const scope: ParentNode = dialogs[dialogs.length - 1] ?? document;
    const els = [
      ...scope.querySelectorAll(`[role="button"]${live}, [role="tab"]${live}, [role="radio"]${live}, button${live}`),
      ...(dialogs.length ? [...document.querySelectorAll('[role="button"][aria-label="Close"]')] : []),
    ] as HTMLElement[];
    const seen = new Set<string>();
    return els
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
      })
      .map((e) => ({
        name: (e.getAttribute('aria-label') || e.innerText || '').replace(/\s+/g, ' ').trim(),
        disabled: e.getAttribute('aria-disabled') === 'true' || (e as HTMLButtonElement).disabled === true,
        selected: e.getAttribute('aria-selected') === 'true' || e.getAttribute('aria-checked') === 'true',
      }))
      .filter((b) => b.name && !seen.has(b.name) && seen.add(b.name));
  }, LIVE);
}

/** What the person can perceive: address, text, selections, typed values, a printed receipt. */
async function perceivable(page: Page) {
  const dom = await page.evaluate(() => ({
    text: document.body.innerText,
    selected: [...document.querySelectorAll('[aria-selected="true"], [aria-checked="true"]')]
      .map((e) => (e as HTMLElement).getAttribute('aria-label') || (e as HTMLElement).innerText)
      .join('|'),
    values: [...document.querySelectorAll('input, textarea')].map((e) => (e as HTMLInputElement).value).join('|'),
    receipt: (document.querySelector('iframe[data-receipt]') as HTMLIFrameElement | null)?.contentDocument?.body?.innerText ?? '',
  }));
  return { url: page.url(), ...dom };
}

/** Taps one button (found again by name on a freshly loaded screen) and describes what happened. */
async function tap(page: Page, url: string, name: string, prepare?: (p: Page) => Promise<void>): Promise<{ ok: boolean; result: string }> {
  await page.goto(url);
  await settle(page);
  if (prepare) {
    await prepare(page);
    await settle(page);
  }
  const dialog = page.locator('[aria-modal="true"]').last();
  const scope = (await dialog.count()) ? dialog : page.locator('body');
  const byName = (root: typeof scope) =>
    root
      .getByRole('button', { name, exact: true })
      .or(root.getByRole('tab', { name, exact: true }))
      .or(root.getByRole('radio', { name, exact: true }));
  const backdrop = name === 'Close' && (await dialog.count());
  const target = (backdrop ? page.getByRole('button', { name: 'Close', exact: true }) : byName(scope))
    .filter({ visible: true })
    .first();
  await target.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  if (!(await target.count())) return { ok: true, result: 'not present after reload (an earlier tap changed the data)' };

  const before = await perceivable(page);
  const errors: string[] = [];
  const onError = (e: Error) => errors.push(e.message);
  // "Choose photo" opens the device's own photo picker, which a headless browser does not draw.
  let picker = false;
  const onChooser = () => (picker = true);
  // Exports (CSV, backup ZIP) arrive as a download on the web.
  let downloaded = '';
  const onDownload = (d: { suggestedFilename: () => string }) => (downloaded = d.suggestedFilename());
  page.on('pageerror', onError);
  page.on('filechooser', onChooser);
  page.on('download', onDownload);
  await target
    .click({ timeout: 5_000, ...(backdrop ? { position: { x: 12, y: 12 } } : {}) })
    .catch((e: Error) => errors.push(`click: ${e.message.split('\n')[0]}`));
  await page.waitForTimeout(900);
  page.off('pageerror', onError);
  page.off('filechooser', onChooser);
  page.off('download', onDownload);

  const after = await perceivable(page);
  const text = after.text;
  if (errors.length) return { ok: false, result: `ERROR ${errors[0]}` };
  if (picker) return { ok: true, result: 'opens the photo picker' };
  if (downloaded) return { ok: true, result: `downloads ${downloaded}` };
  if (/Unmatched Route|This screen doesn't exist|doesn't exist/i.test(text)) return { ok: false, result: 'leads to an unbuilt route' };
  if (/Your role cannot do this|Something went wrong/.test(text) && !/Your role cannot do this|Something went wrong/.test(before.text))
    return { ok: false, result: 'shows an error' };
  if (after.receipt && after.receipt !== before.receipt) return { ok: true, result: `prints the receipt ("${after.receipt.trim().split('\n')[0]!.slice(0, 40)}")` };
  if (after.url !== before.url) return { ok: true, result: `opens ${new URL(after.url).pathname}` };
  if (after.text !== before.text) {
    const added = after.text.split('\n').find((l) => l.trim() && !before.text.includes(l.trim()));
    return { ok: true, result: added ? `shows "${added.trim().slice(0, 50)}"` : 'updates the screen' };
  }
  if (after.selected !== before.selected) return { ok: true, result: 'selects it' };
  if (after.values !== before.values) return { ok: true, result: 'fills in a value' };
  return { ok: false, result: 'NO VISIBLE EFFECT' };
}

async function sweepScreen(page: Page, rows: Row[], screen: string, url: string, prepare?: (p: Page) => Promise<void>) {
  await page.goto(url);
  await settle(page);
  if (prepare) {
    await prepare(page);
    await settle(page);
  }
  for (const b of await visibleButtons(page)) {
    if (SKIP[b.name]) {
      rows.push({ screen, button: b.name, result: `covered by ${SKIP[b.name]}`, ok: true });
    } else if (b.disabled) {
      rows.push({ screen, button: b.name, result: 'disabled until the form is valid / state allows', ok: true });
    } else if (b.selected) {
      rows.push({ screen, button: b.name, result: 'already selected', ok: true });
    } else {
      const r = await tap(page, url, b.name, prepare);
      rows.push({ screen, button: b.name, ...r });
    }
  }
}

async function seed(owner: Owner, mode: Mode) {
  const svc = SERVICE[mode];
  const { data: customer } = await owner.client
    .from('customers')
    .insert({ business_id: owner.businessId, name: 'Sweep Customer', phone: '+971 50 111 2222' })
    .select('id')
    .single();
  const sale = await sellService(owner.client, owner, svc.name);
  const { data: service } = await admin.from('services').select('id').eq('business_id', owner.businessId).eq('name', svc.name).single();
  await owner.client.rpc('create_appointment', {
    p: { branch_id: owner.branchId, kind: 'walk_in', guest_name: 'Sweep Walk-in', service_ids: [service!.id] },
  });
  // M2: an expense, a supplier bill, a retail product on the shelf.
  const { data: tea } = await admin.from('expense_categories').select('id').eq('business_id', owner.businessId).eq('key', 'tea_food').single();
  const { data: expense } = await owner.client.rpc('record_expense', {
    p: { branch_id: owner.branchId, category_id: tea!.id, amount_minor: 1500, method: 'cash', note: 'Sweep tea' },
  });
  const { data: supplierId } = await owner.client.rpc('save_supplier', {
    p: { business_id: owner.businessId, name: 'Sweep Supplier', terms_days: 30 },
  });
  const { data: bill } = await owner.client.rpc('post_purchase_bill', {
    p: { branch_id: owner.branchId, supplier_id: supplierId, lines: [{ description: 'Towels', qty: 2, unit_cost_minor: 1500 }] },
  });
  const { data: itemId } = await owner.client.rpc('save_item', {
    p: { business_id: owner.businessId, name: 'Sweep Oil', kind: 'retail', sell_price_minor: 5000, reorder_level: 2 },
  });
  await owner.client.rpc('set_opening_stock', { p_branch: owner.branchId, p_items: [{ item_id: itemId, qty: 5, unit_cost_minor: 2000 }] });
  return {
    customerId: customer!.id as string,
    saleId: sale.sale_id,
    serviceId: service!.id as string,
    expenseId: (expense as { expense_id: string }).expense_id,
    billId: (bill as { bill_id: string }).bill_id,
    itemId: itemId as string,
    branchId: owner.branchId,
    employeeId: (await admin.from('employees').select('id').eq('business_id', owner.businessId).neq('role_title', 'cashier').limit(1).single()).data!.id as string,
  };
}

function report(mode: Mode, role: string, rows: Row[]) {
  // Straight into docs: the test runner empties e2e-results at the start of every run.
  mkdirSync('docs/button-sweep', { recursive: true });
  const lines = [
    `# Button sweep — ${mode} — ${role}`,
    '',
    '| Screen | Button | Result |',
    '|---|---|---|',
    ...rows.map((r) => `| ${r.screen} | ${r.button.replace(/\|/g, '/')} | ${r.ok ? '' : '❌ '}${r.result.replace(/\|/g, '/')} |`),
  ];
  writeFileSync(`docs/button-sweep/button-sweep-${mode}-${role}.md`, lines.join('\n'));
}

test.describe.configure({ timeout: 2_400_000 });
// The sweep writes its own report; a trace over hundreds of page loads runs to gigabytes.
test.use({ trace: 'off', screenshot: 'off' });

test('owner: every button on every screen does something visible', { tag: '@sweep' }, async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 10_000 });
  await createStaff(owner, 'staff', { name: SERVICE[mode].staff });
  const s = await seed(owner, mode);
  await ownerOn(page, mode, owner.email, owner.password);
  const addToBasket = async (p: Page) => {
    await id(p, `tile-${SERVICE[mode].name}-add`).click();
  };
  const openCheckout = async (p: Page) => {
    await addToBasket(p);
    await id(p, 'checkout').click();
    await expect(id(p, 'save-sale')).toBeVisible();
  };

  const rows: Row[] = [];
  const screens: [string, string, ((p: Page) => Promise<void>)?][] = [
    ['Home', '/'],
    ['Queue', '/queue'],
    ['New walk-in', '/appointment/new?kind=walk_in'],
    ['New booking', '/appointment/new?kind=booking'],
    ['Quick sale', '/sale'],
    ['Quick sale (basket)', '/sale', addToBasket],
    ['Checkout', '/sale', openCheckout],
    ['Customers', '/customers'],
    ['Customer profile', `/customers/${s.customerId}`],
    ['Customer form', `/customers/form?id=${s.customerId}`],
    ['More', '/more'],
    ['Services', '/services'],
    ['Service form', `/services/form?id=${s.serviceId}`],
    ['Categories', '/services/categories'],
    ['Sales', '/sales'],
    ['Sale detail', `/sales/${s.saleId}`],
    ['Team & logins', '/settings/team'],
    ['Branch settings', '/settings/branch'],
    ['Accounts & history', '/accounts'],
    ['Expenses', '/expenses'],
    ['New expense', '/expenses/new'],
    ['Expense detail', `/expenses/${s.expenseId}`],
    ['Purchases', '/purchases'],
    ['New bill', '/purchases/new'],
    ['Bill detail', `/purchases/${s.billId}`],
    ['Cash closing', '/cash-closing'],
    ['Inventory', '/inventory'],
    ['Item detail', `/inventory/${s.itemId}`],
    ['Item form', `/inventory/form?id=${s.itemId}`],
    ['Stock count', '/inventory/count'],
    ['Opening stock', '/inventory/opening'],
    ['Staff & payroll', '/staff'],
    ['Staff profile', `/staff/${s.employeeId}`],
    ['Staff form', `/staff/form?id=${s.employeeId}`],
    ['Attendance', '/attendance'],
    ['Payroll', '/payroll'],
    ['Bonuses & advances', '/payroll/adjustments'],
    ['Compliance', '/compliance'],
    ['Compliance · binder', '/compliance?tab=binder'],
    ['Compliance · hygiene', '/compliance?tab=hygiene'],
    ['Compliance · WPS & Montaji', '/compliance?tab=wps'],
    ['Compliance record', '/compliance/doc?type=trade_licence&branch=' + s.branchId],
    ['Notifications', '/notifications'],
    // M4
    ['Reports', '/reports'],
    ['Reports · staff sales', '/reports?type=staff'],
    ['Reports · daily closing', '/reports?type=closing'],
    ['Reports · stock', '/reports?type=stock'],
    ['Reports · cash shortage', '/reports?type=shortages'],
    ['Reports · customers', '/reports?type=customers'],
    ['Close month', '/accounts/close-period'],
    ['Backup & recovery', '/settings/backup'],
    ['Plan & billing', '/plan'],
  ];
  for (const [screen, url, prepare] of screens) await sweepScreen(page, rows, screen, url, prepare);
  report(mode, 'owner', rows);
  expect(rows.filter((r) => !r.ok), 'buttons that failed').toEqual([]);
});

test('cashier and staff: their buttons work and none hit a permission error', { tag: '@sweep' }, async ({ page, mode, device }) => {
  const owner = await createOwner(mode, { openingCash: 10_000 });
  const cashier = await createStaff(owner, 'cashier');
  const staff = await createStaff(owner, 'staff');
  const s = await seed(owner, mode);

  await staffOn(page, mode, owner.code, cashier.username, cashier.password);
  const rows: Row[] = [];
  for (const [screen, url] of [
    ['Home', '/'],
    ['Queue', '/queue'],
    ['Quick sale', '/sale'],
    ['Customers', '/customers'],
    ['Customer profile', `/customers/${s.customerId}`],
    ['More', '/more'],
    ['Services', '/services'],
    ['Sales', '/sales'],
    ['Sale detail', `/sales/${s.saleId}`],
    ['Expenses', '/expenses'],
    ['New expense', '/expenses/new'],
    ['Purchases', '/purchases'],
    ['New bill', '/purchases/new'],
    ['Cash closing', '/cash-closing'],
    ['Inventory', '/inventory'],
    ['Item detail', `/inventory/${s.itemId}`],
    ['Attendance', '/attendance'],
    ['Compliance · hygiene', '/compliance'],
    ['Notifications', '/notifications'],
  ] as const)
    await sweepScreen(page, rows, screen, url);
  report(mode, 'cashier', rows);

  const phone = await device();
  await staffOn(phone, mode, owner.code, staff.username, staff.password);
  const staffRows: Row[] = [];
  for (const [screen, url] of [
    ['Home', '/'],
    ['Queue', '/queue'],
    ['More', '/more'],
    ['Services', '/services'],
    ['Inventory', '/inventory'],
    ['Item detail', `/inventory/${s.itemId}`],
    ['My pay', '/pay'],
  ] as const)
    await sweepScreen(phone, staffRows, screen, url);
  report(mode, 'staff', staffRows);

  expect([...rows, ...staffRows].filter((r) => !r.ok), 'buttons that failed').toEqual([]);
});

test('accountant: reports and books work read-only', { tag: '@sweep' }, async ({ page, mode }) => {
  const owner = await createOwner(mode, { openingCash: 10_000 });
  const accountant = await createStaff(owner, 'accountant');
  await createStaff(owner, 'staff', { name: SERVICE[mode].staff });
  await seed(owner, mode);
  await staffOn(page, mode, owner.code, accountant.username, accountant.password);
  const rows: Row[] = [];
  for (const [screen, url] of [
    ['Home', '/'],
    ['Reports tab', '/reports-tab'],
    ['Reports · customers', '/reports?type=customers'],
    ['Accounting tab', '/accounts-tab'],
    ['Close month', '/accounts/close-period'],
    ['More', '/more'],
    ['Expenses', '/expenses'],
    ['Purchases', '/purchases'],
    ['Staff & payroll', '/staff'],
    ['Payroll', '/payroll'],
    ['Plan & billing', '/plan'],
  ] as const)
    await sweepScreen(page, rows, screen, url);
  report(mode, 'accountant', rows);
  expect(rows.filter((r) => !r.ok), 'buttons that failed').toEqual([]);
});
