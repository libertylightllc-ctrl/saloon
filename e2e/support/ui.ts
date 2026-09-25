/** Screen actions shared by the flows. testIDs render as data-testid on web. */
import { expect, type Page } from '@playwright/test';

import type { Mode } from './api';
import { THEME } from './fixtures';

/**
 * Screens under the current one stay mounted on web: stacked screens are hidden, inactive tabs are
 * aria-hidden. Only what the person can actually see and reach counts.
 */
const LIVE = ':not([aria-hidden="true"] *)';
export const id = (page: Page, testId: string) =>
  page.locator(`[data-testid="${testId}"]${LIVE}`).filter({ visible: true });
export const idStarts = (page: Page, prefix: string) =>
  page.locator(`[data-testid^="${prefix}"]${LIVE}`).filter({ visible: true });
export const text = (page: Page, value: string | RegExp, exact = false) =>
  page.getByText(value, { exact }).and(page.locator(`*${LIVE}`)).filter({ visible: true });
export const field = (page: Page, name: string) => id(page, `field-${name}`);

/** Fresh device: welcome → pick the salon type → sign-in. */
export async function chooseType(page: Page, mode: Mode) {
  await page.goto('/');
  await id(page, `welcome-${mode}`).click();
  await expect(id(page, 'sign-in-submit')).toBeVisible();
}

export async function signInOwner(page: Page, email: string, password: string) {
  await id(page, 'sign-in-as-owner').click();
  await field(page, 'email').fill(email);
  await field(page, 'password').fill(password);
  await id(page, 'sign-in-submit').click();
  await expect(id(page, 'tab-index')).toBeVisible({ timeout: 30_000 });
}

export async function signInStaff(page: Page, code: string, username: string, password: string) {
  await id(page, 'sign-in-as-staff').click();
  await field(page, 'salonCode').fill(code);
  await field(page, 'username').fill(username);
  await field(page, 'password').fill(password);
  await id(page, 'sign-in-submit').click();
  await expect(id(page, 'tab-index')).toBeVisible({ timeout: 30_000 });
}

/** A new device that picks `deviceMode` on the welcome screen, then signs in. */
export async function ownerOn(page: Page, deviceMode: Mode, email: string, password: string) {
  await chooseType(page, deviceMode);
  await signInOwner(page, email, password);
}

export async function staffOn(page: Page, deviceMode: Mode, code: string, username: string, password: string) {
  await chooseType(page, deviceMode);
  await signInStaff(page, code, username, password);
}

/** The header's back button. */
export async function back(page: Page) {
  await page.getByRole('button', { name: 'Back' }).filter({ visible: true }).first().click();
}

export async function tab(page: Page, name: 'index' | 'queue' | 'sale' | 'customers' | 'more') {
  await id(page, `tab-${name}`).click();
}

/** The tabs this role can see, in order. */
export async function visibleTabs(page: Page): Promise<string[]> {
  const tabs = page.locator('[data-testid^="tab-"]');
  await expect(tabs.first()).toBeVisible();
  return tabs.evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getAttribute('data-testid')!.slice(4)),
  );
}

/** The selected tab's label is drawn in the theme's primary text colour. */
export async function expectTheme(page: Page, mode: Mode) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const tab = document.querySelector('[role="tab"][aria-selected="true"][data-testid^="tab-"]');
          if (!tab) return null;
          const colours = [...tab.querySelectorAll('*')].map((el) => getComputedStyle(el).color);
          return colours;
        }),
      { timeout: 10_000 },
    )
    .toContain(THEME[mode].primaryText);
}

/** Money as the app prints it: "AED 25.00" → 2500. */
export function minor(text: string | null): number {
  const digits = (text ?? '').replace(/[^\d.-]/g, '');
  return Math.round(Number(digits) * 100);
}

export async function moneyOf(page: Page, testId: string): Promise<number> {
  return minor(await id(page, testId).innerText());
}

/** Saved for review under e2e-results/shots/. */
export async function snap(page: Page, name: string, mode: Mode) {
  await page.screenshot({ path: `e2e-results/shots/${mode}-${name}.png` });
}

/** Waits until the amount shown under `testId` equals `expected` (minor units). */
export async function expectMoney(page: Page, testId: string, expected: number, timeout = 15_000) {
  await expect.poll(() => moneyOf(page, testId).catch(() => NaN), { timeout }).toBe(expected);
}
