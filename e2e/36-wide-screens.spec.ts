/**
 * Wider screens (owner's choice 2026-10-04): computers get a sidebar and dashboards (Option A), tablets an icon rail
 * and two panes (Option B), phones stay as they are (every other flow runs at phone size). Here the owner runs the
 * counter from a computer and a tablet: navigate from the side, sell from the always-open sale panel, and work the
 * queue from the list + visit panes.
 */
import type { Page } from '@playwright/test';

import { admin, createOwner, latestSale, type Mode, type Owner } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { chooseType, expectMoney, field, id, idStarts, snap } from './support/ui';

async function signInWide(page: Page, mode: Mode, owner: Owner) {
  await chooseType(page, mode);
  await id(page, 'sign-in-as-owner').click();
  await field(page, 'email').fill(owner.email);
  await field(page, 'password').fill(owner.password);
  await id(page, 'sign-in-submit').click();
  await expect(id(page, 'nav-index')).toBeVisible({ timeout: 30_000 });
}

async function walkIn(owner: Owner, mode: Mode, guest: string): Promise<string> {
  const { data: service } = await admin.from('services').select('id').eq('business_id', owner.businessId).eq('name', SERVICE[mode].name).single();
  const { data, error } = await owner.client.rpc('create_appointment', {
    p: { branch_id: owner.branchId, kind: 'walk_in', guest_name: guest, service_ids: [service!.id] },
  });
  if (error) throw error;
  return data as string;
}

test.describe('computer (1440 × 900)', () => {
  test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false });

  test('the sidebar replaces the tab bar; a sale from the side panel; the queue in two panes', async ({ page, mode }) => {
    const owner = await createOwner(mode, { openingCash: 20_000 });
    const svc = SERVICE[mode];
    const visit = await walkIn(owner, mode, 'Wide Guest');
    await signInWide(page, mode, owner);

    // Sidebar with sections, no bottom tabs; Home is the dashboard.
    await expect(id(page, 'tab-index')).toHaveCount(0);
    for (const key of ['nav-queue', 'nav-sale', 'nav-customers', 'nav-sales', 'nav-expenses', 'nav-cashClosing', 'nav-staff', 'nav-reports', 'nav-branch', 'nav-more']) {
      await expect(id(page, key)).toBeVisible();
    }
    await expect(id(page, 'nav-index')).toHaveAttribute('aria-current', 'page');
    await expect(id(page, 'home-add-walk-in')).toBeVisible();
    await expectMoney(page, 'kpi-expected-cash-value', 20_000);
    await snap(page, 'wide-home', mode);

    // A page from the sidebar, and back to a tab.
    await id(page, 'nav-sales').click();
    await expect(page).toHaveURL(/\/sales$/);
    await expect(id(page, 'nav-sales')).toHaveAttribute('aria-current', 'page');
    await id(page, 'nav-sale').click();
    await expect(page).toHaveURL(/\/sale$/);

    // Quick sale: the panel is always open; no Checkout button, no sheet.
    await expect(id(page, 'sale-panel')).toBeVisible();
    await expect(id(page, 'checkout')).toHaveCount(0);
    await id(page, `tile-${svc.name}-add`).click();
    await expect(id(page, 'save-sale')).toContainText((svc.price / 100).toFixed(2));
    await snap(page, 'wide-sale', mode);
    await id(page, 'save-sale').click();
    await expect(id(page, 'sale-done')).toBeVisible();
    expect(await latestSale(owner.branchId)).toMatchObject({ total_minor: svc.price });
    await id(page, 'new-sale').click();
    await expect(id(page, 'sale-panel')).toContainText('Tap services to start a sale.');

    // Queue: pick the visit, start it and complete it from the visit pane; checkout opens filled in.
    await id(page, 'nav-queue').click();
    await expect(id(page, `queue-row-${visit}`)).toBeVisible();
    await id(page, `queue-row-${visit}`).click();
    await expect(id(page, 'visit-name')).toHaveText('Wide Guest');
    await snap(page, 'wide-queue', mode);
    await id(page, 'visit-start').click();
    await expect(id(page, 'visit-complete')).toBeVisible();
    await id(page, 'visit-complete').click();
    await expect(page).toHaveURL(/\/sale/);
    await expect(id(page, 'save-sale')).toContainText((svc.price / 100).toFixed(2));
    await id(page, 'save-sale').click();
    await expect(id(page, 'sale-done')).toBeVisible();
    const { data: done } = await admin.from('appointments').select('status').eq('id', visit).single();
    expect(done!.status).toBe('completed');
  });
});

test.describe('tablet, landscape (1180 × 820)', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true });

  test('the icon rail holds the counter pages; everything else is under More', async ({ page, mode }) => {
    const owner = await createOwner(mode);
    await walkIn(owner, mode, 'Rail Guest');
    await signInWide(page, mode, owner);
    for (const key of ['nav-queue', 'nav-sale', 'nav-customers', 'nav-cashClosing', 'nav-reports', 'nav-more']) {
      await expect(id(page, key)).toBeVisible();
    }
    await expect(id(page, 'nav-expenses')).toHaveCount(0);
    await expect(id(page, 'tab-index')).toHaveCount(0);

    // Two panes: the first visit is shown beside the list.
    await id(page, 'nav-queue').click();
    await expect(id(page, 'visit-name')).toHaveText('Rail Guest');
    await expect(idStarts(page, 'queue-start-')).toHaveCount(0);

    // A page that is not on the rail lights More.
    await id(page, 'nav-more').click();
    await id(page, 'more-expenses').click();
    await expect(page).toHaveURL(/\/expenses$/);
    await expect(id(page, 'nav-more')).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('tablet, upright (820 × 1180)', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true });

  test('the rail stays, but one pane at a time: row buttons in the queue, Checkout in a sheet', async ({ page, mode }) => {
    const owner = await createOwner(mode);
    const visit = await walkIn(owner, mode, 'Upright Guest');
    await signInWide(page, mode, owner);
    await id(page, 'nav-queue').click();
    await expect(id(page, `queue-start-${visit}`)).toBeVisible();
    await expect(id(page, 'visit-panel')).toHaveCount(0);
    await id(page, 'nav-sale').click();
    await expect(id(page, 'sale-panel')).toHaveCount(0);
    await id(page, `tile-${SERVICE[mode].name}-add`).click();
    await id(page, 'checkout').click();
    await expect(id(page, 'save-sale')).toBeVisible();
  });
});
