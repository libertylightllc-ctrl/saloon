/** The landing page: what the app does, the way in for new owners, and the way back to it from the sign-in. */
import { expect, test, THEME } from './support/fixtures';
import { id, snap, text } from './support/ui';

test('a new visitor reads what the app does, picks a salon type and lands on the owner sign-up in that look', async ({ page, mode }) => {
  await page.goto('/');
  await expect(text(page, 'Run your salon from your phone')).toBeVisible();
  for (const feature of ['Walk-ins and bookings', 'Daily cash closing', 'UAE compliance', 'Books and reports']) {
    await expect(text(page, feature, true)).toBeVisible();
  }
  await expect(text(page, 'Which salon are you?')).toBeVisible();
  // The placeholder support address is never shown.
  await expect(text(page, /example\.com/)).toHaveCount(0);
  await snap(page, 'landing', mode);

  // "Create your salon" → pick the type → the owner sign-up, already in that salon's colours.
  await id(page, 'landing-create').click();
  await id(page, `welcome-${mode}`).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(id(page, 'sign-up-submit')).toHaveCSS('background-color', THEME[mode].primaryAction);

  // Next visit on this device goes straight to the sign-in, which links back to the landing page.
  await page.goto('/');
  await expect(id(page, 'sign-in-submit')).toBeVisible();
  await id(page, 'link-about').click();
  await expect(text(page, 'Run your salon from your phone')).toBeVisible();
  // Someone who already chose a type goes straight on from "Sign in".
  await id(page, 'landing-sign-in').click();
  await expect(id(page, 'sign-in-submit')).toHaveCSS('background-color', THEME[mode].primaryAction);
});
