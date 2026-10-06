/** The platform console (owner, 2026-10-06): a dev account with no salon of its own opens it from setup and sees the
 * whole service — totals, every salon with its activity, every account, plans and the history — and names another
 * platform owner. A salon owner never reaches it. */
import { randomUUID } from 'crypto';

import { admin, createOwner, makePlatformAdmin, sellCustom } from './support/api';
import { expect, test } from './support/fixtures';
import { chooseType, field, id, ownerOn, snap, tab } from './support/ui';

test('a dev account with no salon sees everything in the platform console', async ({ page, mode, device }) => {
  const salon = await createOwner(mode);
  await sellCustom(salon.client, salon, { cash: 4_500 });
  const devEmail = `dev-${randomUUID().slice(0, 8)}@e2e.test`;
  const devPassword = `Dev-${randomUUID().slice(0, 8)}!`;
  const { error } = await admin.auth.admin.createUser({ email: devEmail, password: devPassword, email_confirm: true });
  if (error) throw error;
  await makePlatformAdmin(devEmail);

  // No salon: setup offers the console.
  await chooseType(page, mode);
  await id(page, 'sign-in-as-owner').click();
  await field(page, 'email').fill(devEmail);
  await field(page, 'password').fill(devPassword);
  await id(page, 'sign-in-submit').click();
  await id(page, 'setup-console').click();
  await expect(id(page, 'console-salons-value')).not.toHaveText('0');
  await expect(id(page, 'console-accounts-value')).not.toHaveText('0');
  await snap(page, 'console-overview', mode);

  // Salons: the salon with its owner, staff, sales and history.
  await id(page, 'console-tab-salons').click();
  await id(page, 'console-salon-search').fill(salon.code);
  const row = id(page, `admin-salon-${salon.code}`);
  await expect(row).toContainText(salon.email);
  await expect(row).toContainText('1 sale in 30 days');
  await snap(page, 'console-salons', mode);
  await row.click();
  await id(page, 'console-salon-history').click();
  await expect(id(page, 'console-activity-clear')).toBeVisible();
  await expect(page.getByText(/Saved sale #\d+/).first()).toBeVisible();

  // Accounts: every sign-in, and naming another platform owner by email.
  await id(page, 'console-tab-accounts').click();
  await id(page, 'console-account-search').fill(salon.email);
  await expect(id(page, `console-account-${salon.email}`)).toContainText('Owner');
  await id(page, 'console-owner-email').fill(salon.email);
  await id(page, 'console-owner-add').click();
  await expect(id(page, `console-account-${salon.email}`)).toContainText('Platform owner');
  await id(page, `console-owner-remove-${salon.email}`).click();
  await expect(id(page, `console-account-${salon.email}`)).not.toContainText('Platform owner');

  // Plans: the history of requests and payments opens.
  await id(page, 'console-tab-plans').click();
  await expect(id(page, 'console-tab-plans')).toHaveAttribute('aria-selected', 'true');

  // A salon owner is sent home from the console and has no menu entry for it.
  const shop = await device();
  await ownerOn(shop, mode, salon.email, salon.password);
  await tab(shop, 'more');
  await expect(id(shop, 'more-admin')).toHaveCount(0);
  await shop.goto('/console');
  await expect(id(shop, 'tab-index')).toBeVisible({ timeout: 30_000 });
});

test('the dev account closes a demo salon and then its own salon, and keeps the console', async ({ page, mode, device }) => {
  const dev = await createOwner(mode);
  await makePlatformAdmin(dev.email);
  const demo = await createOwner(mode);

  await ownerOn(page, mode, dev.email, dev.password);
  await page.goto('/console');
  await id(page, 'console-tab-salons').click();

  // Another salon: closed with a reason; its owner can no longer sign in.
  await id(page, 'console-salon-search').fill(demo.code);
  await id(page, `admin-salon-${demo.code}`).click();
  await id(page, 'console-close-reason').fill('Demo salon, not a customer');
  await id(page, 'console-close-salon').click();
  await expect(id(page, `admin-salon-${demo.code}`)).toContainText('Closed');
  const shop = await device();
  await chooseType(shop, mode);
  await id(shop, 'sign-in-as-owner').click();
  await field(shop, 'email').fill(demo.email);
  await field(shop, 'password').fill(demo.password);
  await id(shop, 'sign-in-submit').click();
  await expect(shop.getByText('This login is disabled', { exact: false }).first()).toBeVisible({ timeout: 30_000 });

  // Its own salon: the dev account stays signed in and keeps the console.
  await id(page, 'console-salon-search').fill(dev.code);
  await id(page, `admin-salon-${dev.code}`).click();
  await id(page, 'console-close-reason').fill('Demo shop');
  await id(page, 'console-close-salon').click();
  await expect(id(page, `admin-salon-${dev.code}`)).toContainText('Closed');
  await page.goto('/');
  await expect(page).toHaveURL(/\/console$/, { timeout: 30_000 });
  await expect(id(page, 'console-salons-value')).toBeVisible();
});
