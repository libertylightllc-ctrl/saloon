/** The landing page: what the app does, the way in for new owners, and the way back to it from the sign-in. */
import { expect, test, THEME } from './support/fixtures';
import { id, snap, text } from './support/ui';

test('a new visitor reads what the app does, picks a salon type and lands on the owner sign-up in that look', async ({ page, mode }) => {
  await page.goto('/');
  await expect(text(page, 'Run your salon from your phone')).toBeVisible();
  for (const feature of ['Walk-ins and bookings', 'Daily cash closing', 'Licences and inspections', 'Books and reports']) {
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

test('"Continue with Google" shows only when Google is switched on, and sends people to Google and back to the site', async ({ page, mode }) => {
  // The local database has Google off: no button.
  await page.goto('/');
  await id(page, `welcome-${mode}`).click();
  await expect(id(page, 'sign-in-submit')).toBeVisible();
  await expect(id(page, 'google-sign-in')).toHaveCount(0);

  // Switched on (as on the hosted project once Google is set up): the button appears on sign-in and sign-up.
  await page.route('**/auth/v1/settings', async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { external: Record<string, boolean> };
    await route.fulfill({ response: res, json: { ...body, external: { ...body.external, google: true } } });
  });
  let authorize = '';
  await page.route('**/auth/v1/authorize**', (route) => {
    authorize = route.request().url();
    return route.fulfill({ contentType: 'text/html', body: '<p>Google</p>' });
  });
  await page.reload();
  await expect(id(page, 'google-sign-in')).toBeVisible();
  await id(page, 'link-sign-up').click();
  await expect(id(page, 'google-sign-in')).toBeVisible();
  const site = new URL(page.url()).origin;
  await id(page, 'google-sign-in').click();
  await expect.poll(() => authorize).toContain('provider=google');
  expect(new URL(authorize).searchParams.get('redirect_to')).toBe(`${site}/`);
});
