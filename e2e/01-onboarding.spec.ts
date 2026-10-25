import { uid } from './support/env';
import { expect, test, THEME } from './support/fixtures';
import { chooseType, expectMoney, expectTheme, field, id, text } from './support/ui';

test('fresh device → type → themed sign-in → owner sign-up → setup → empty Home', async ({ page, mode }) => {
  const email = `new-${uid()}@e2e.test`;

  await chooseType(page, mode);
  // The sign-in is already in the chosen theme, with no salon-type switch (a returning owner's salon has its type;
  // website brief 1.6, 2026-10-22). Remembered across a reload.
  await expect(id(page, 'sign-in-submit')).toHaveCSS('background-color', THEME[mode].primaryAction);
  await expect(id(page, 'salon-type-gents')).toHaveCount(0);
  await page.reload();
  await expect(id(page, 'sign-in-submit')).toHaveCSS('background-color', THEME[mode].primaryAction);

  // Sign-up: no salon-type switch either (setup asks it, from the type picked on the home page; brief 3.5); one
  // password field (brief 3.2); the offer under the title and above the button (brief 3.1).
  await id(page, 'link-sign-up').click();
  await expect(id(page, 'salon-type-gents')).toHaveCount(0);
  await expect(field(page, 'confirm')).toHaveCount(0);
  await expect(id(page, 'auth-offer')).toHaveText('Free to start · No card needed · No auto-renewal');
  await expect(id(page, 'sign-up-offer-small')).toHaveCount(0);
  await expect(id(page, 'sign-up-to-sign-in')).toBeVisible();
  await id(page, 'sign-up-submit').click();
  await expect(text(page, 'Required').first()).toBeVisible(); // validation before any request
  await field(page, 'name').fill('Test Owner');
  await field(page, 'email').fill(email);
  await field(page, 'password').fill('Owner1234!');
  await id(page, 'sign-up-submit').click();

  // Setup wizard: mode is pre-selected from the device choice.
  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 30_000 });
  await field(page, 'businessName').fill(`Test ${mode} salon`);
  await id(page, 'setup-next').click();
  await id(page, 'setup-next').click(); // country: UAE
  await expect(id(page, `setup-mode-${mode}`)).toHaveAttribute('aria-checked', 'true');
  await id(page, 'setup-next').click();
  await field(page, 'branchName').fill('Main branch');
  await id(page, 'setup-next').click();
  await field(page, 'openingCash').fill('500');
  await id(page, 'setup-next').click(); // create

  // Home, themed, with real numbers and empty states.
  await expect(id(page, 'tab-index')).toBeVisible({ timeout: 30_000 });
  await expectTheme(page, mode);
  await expect(id(page, 'home-greeting')).toContainText('Test Owner');
  await expectMoney(page, 'kpi-expected-cash-value', 50_000);
  await expectMoney(page, 'kpi-sales-value', 0);
  await expect(text(page, 'No one is waiting. Add a walk-in.')).toBeVisible();
  await expect(text(page, 'No sales yet today.')).toBeVisible();
  await expect(text(page, 'Finish setting up')).toBeVisible();
});
