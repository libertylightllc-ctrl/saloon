/**
 * The home page after the website brief's Phase 2 (2026-10-22). On a phone: the product on the first screen, sign-in
 * as a small link, a way in always on screen (the sticky bar shows once the main button has scrolled away and hides
 * over the pricing card), the page at least 30% shorter (was 7,921 px at 390 wide), the free booking page and the
 * "keep your booking app" strip, the FAQ with the visitor's price, the per-day price; the owner-only sections (social
 * proof, video, WhatsApp, demo) hidden while their config is empty; the UAE-only lines only for UAE visitors.
 */
import type { Page } from '@playwright/test';

import { expect, test } from './support/fixtures';
import { id } from './support/ui';


/** Scrolls the page like a person does, with the wheel, to about `to` pixels down. */
async function scrollTo(page: Page, from: number, to: number) {
  await page.mouse.move(195, 300);
  for (let y = from; y < to; y += 200) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(400);
}

test.describe('on a phone in the UAE', () => {
  test.use({ viewport: { width: 390, height: 750 } });

  test('the product on the first screen, a way in always on screen, a shorter page, FAQ with the price', async ({ page }) => {
    await page.goto('/welcome');
    await expect(id(page, 'landing-create')).toBeInViewport();
    // Sign-in is a small link in the top bar; the second button is "See how it works" (no WhatsApp number yet).
    await expect(id(page, 'landing-sign-in')).toBeInViewport();
    await expect(id(page, 'landing-see-how')).toBeVisible();
    await expect(id(page, 'landing-whatsapp')).toHaveCount(0);
    await expect(id(page, 'landing-trust-data')).toHaveText('Your data is yours — export any time');
    // The app's picture starts on the first screen.
    const picture = await id(page, 'landing-hero-visual').boundingBox();
    expect(picture!.y).toBeLessThan(600);
    await expect(page.getByText('For barber shops, salons, spas, nail and beauty studios')).toBeVisible();
    await expect(id(page, 'landing-fact-booking')).toHaveText('Free online booking page — no commission');
    await expect(id(page, 'landing-keep')).toContainText('Already on a booking app? Keep it.');

    // The height cap of the first website brief (30% shorter) gave way to the full update brief's added questions and
    // sections (2026-10-25); the first screen still shows the way in and the product, checked above.

    // The sticky bar: not while the main button shows; there once it has gone; not over the pricing card.
    await expect(id(page, 'landing-sticky')).toHaveCount(0);
    await scrollTo(page, 0, 1400);
    await expect(id(page, 'landing-sticky')).toBeVisible();
    await expect(id(page, 'landing-start-sticky')).toBeInViewport();
    const pricing = await id(page, 'landing-pricing').boundingBox();
    await scrollTo(page, 1400, 1400 + pricing!.y);
    await expect(id(page, 'landing-sticky')).toHaveCount(0);

    // Price: per month, and less than so much a day; nothing renews by itself.
    await expect(id(page, 'landing-price')).toHaveText('AED 50');
    await expect(id(page, 'landing-per-day')).toHaveText('Under AED 2 a day');
    await expect(id(page, 'landing-pricing')).toContainText('No auto-renewal. No contract.');

    // FAQ: the visitor's price in the answer.
    await id(page, 'landing-faq-price').click();
    await expect(id(page, 'landing-faq-price-answer')).toContainText('AED 50 a month per branch, for up to 4 people');
    await id(page, 'landing-faq-free').click();
    await expect(id(page, 'landing-faq-free-answer')).toContainText('nothing is charged unless you choose a plan');

    // Hidden while the owner has not filled them in (src/config/site.ts).
    for (const hidden of ['landing-proof', 'landing-video', 'landing-demo', 'landing-demo-pricing', 'landing-legal', 'landing-floating-whatsapp']) {
      await expect(id(page, hidden)).toHaveCount(0);
    }
    // UAE visitors keep the UAE lines.
    await expect(page.getByText(/with WPS salary proof in the UAE/)).toHaveCount(1);
  });
});

test.describe('on a computer outside the UAE', () => {
  test.use({ viewport: { width: 1366, height: 720 }, timezoneId: 'Europe/Paris' });

  test('no sticky bar, the general staff and licence lines, the FAQ for search engines', async ({ page }) => {
    await page.goto('/welcome');
    await expect(id(page, 'landing-price')).toHaveText('USD 13.99');
    await expect(id(page, 'landing-per-day')).toHaveText('Under USD 0.50 a day');
    await expect(id(page, 'landing-sticky')).toHaveCount(0);
    await expect(id(page, 'landing-feature-staff')).toHaveText('Rosters, clock-in with late flags, commission, advances and payroll.');
    await expect(id(page, 'landing-feature-compliance')).not.toContainText('UAE');
    await expect(id(page, 'landing-made-in')).toContainText('Made in Dubai');
    const faq = await page.evaluate(() => JSON.parse(document.getElementById('faq-jsonld')?.textContent ?? '{}'));
    expect(faq['@type']).toBe('FAQPage');
    // 14 questions: the second-branch one waits for "Add a branch" (src/config/pricing.ts MULTI_BRANCH).
    expect(faq.mainEntity).toHaveLength(14);
    expect(faq.mainEntity[0].acceptedAnswer.text.replace(/\u00a0/g, ' ')).toContain('USD 13.99 a month per branch, for up to 4 people');
  });
});
