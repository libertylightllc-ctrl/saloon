/**
 * Languages: every main screen in Arabic and Urdu (right-to-left) and Hindi — the page direction follows the
 * language, no screen shows a raw translation key, and nothing is wider than the phone.
 */
import type { Page } from '@playwright/test';

import { createOwner, sellService } from './support/api';
import { SERVICE } from './support/catalog';
import { expect, test } from './support/fixtures';
import { id, ownerOn, tab } from './support/ui';

const LANGUAGES = [
  { name: 'العربية', dir: 'rtl', more: 'المزيد' },
  { name: 'اردو', dir: 'rtl', more: 'مزید' },
  { name: 'हिन्दी', dir: 'ltr', more: 'और' },
] as const;

const SCREENS = [
  '/', '/queue', '/sale', '/customers', '/more', '/services', '/sales', '/expenses', '/purchases', '/cash-closing',
  '/inventory', '/staff', '/attendance', '/payroll', '/compliance', '/accounts', '/accounts/close-period', '/reports',
  '/reports?type=staff', '/settings/branch', '/settings/team', '/settings/backup', '/notifications',
];

/** Text that looks like an i18n key (e.g. "reports.kpi.sales") means a missing translation. */
const KEY = /\b(?:common|reports|accounts|backup|quickSwitch|branch|more|sale|sales|customers|queue|inventory|staff|payroll|compliance|errors|closing|expenses|purchases|notifications|tabs|home|services)\.[a-zA-Z_.]+\b/;

async function check(page: Page, dir: string, screen: string) {
  await page.goto(screen);
  await expect(page.locator('html')).toHaveAttribute('dir', dir);
  await expect(page.locator('[role="button"], [role="tab"]').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const found = await page.evaluate((re) => {
    const text = document.body.innerText;
    const key = text.match(new RegExp(re))?.[0] ?? null;
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    return { key, overflow };
  }, KEY.source);
  expect.soft(found.key, `${screen}: raw translation key`).toBeNull();
  expect.soft(found.overflow, `${screen}: wider than the phone`).toBeLessThanOrEqual(1);
}

for (const lang of LANGUAGES) {
  test(`every main screen in ${lang.name}: direction, no raw keys, fits the phone`, async ({ page, mode }) => {
    test.setTimeout(300_000);
    const owner = await createOwner(mode, { openingCash: 10_000 });
    await sellService(owner.client, owner, SERVICE[mode].name, 'cash');
    await ownerOn(page, mode, owner.email, owner.password);
    await tab(page, 'more');
    await id(page, 'more-language').click();
    await page.getByRole('button', { name: lang.name }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', lang.dir);
    await expect(id(page, 'tab-more')).toContainText(lang.more);
    for (const screen of SCREENS) await check(page, lang.dir, screen);
  });
}
