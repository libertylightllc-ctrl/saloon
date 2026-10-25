/**
 * The website follows the visitor (owner, 2026-10-12): it opens in the phone's language when the app has it, else in
 * the language of the country the visitor is in (by IP); the price follows the country (AED in the UAE, USD
 * elsewhere); a language button sits at the top. Vercel's country lookup (api/geo) is stood in for here.
 */
import type { Page } from '@playwright/test';

import { expect, test } from './support/fixtures';
import { id, text } from './support/ui';

async function visitFrom(page: Page, country: string) {
  await page.route('**/api/geo', (route) => route.fulfill({ json: { country } }));
  await page.goto('/');
}

test.describe('a phone in a language the app does not have, in Brazil', () => {
  test.use({ locale: 'de-DE', timezoneId: 'Asia/Dubai' });

  test('opens in Portuguese, with the price of where the visitor is, not of the clock', async ({
    page,
  }) => {
    await visitFrom(page, 'BR');
    await expect(id(page, 'landing-sign-in')).toHaveText('Entrar');
    await expect(id(page, 'language-button')).toHaveText('PT');
    await expect(id(page, 'landing-price')).toHaveText('USD 13.99');
  });
});

test.describe('an English phone in Brazil', () => {
  test.use({ locale: 'en-US' });

  test('stays in English: the phone language comes first', async ({ page }) => {
    await visitFrom(page, 'BR');
    await expect(id(page, 'landing-sign-in')).toHaveText('Sign in');
  });
});

test.describe('a visitor in the UAE on a computer set to Paris time', () => {
  test.use({ timezoneId: 'Europe/Paris' });

  test('sees the UAE price', async ({ page }) => {
    await visitFrom(page, 'AE');
    await expect(id(page, 'landing-price')).toHaveText('AED 50');
    await expect(id(page, 'landing-pricing')).not.toContainText('USD');
  });
});

test('the language button at the top switches the site, and sign-in has it too', async ({
  page,
  mode,
}) => {
  await page.goto('/');
  await expect(id(page, 'language-button')).toHaveText('EN');
  await id(page, 'language-button').click();
  await text(page, 'Français', true).click();
  await expect(id(page, 'landing-sign-in')).toHaveText('Se connecter');
  await expect(id(page, 'language-button')).toHaveText('FR');

  await id(page, `welcome-${mode}`).click();
  await expect(id(page, 'sign-in-submit')).toBeVisible();
  await expect(id(page, 'language-button')).toHaveText('FR');
});
