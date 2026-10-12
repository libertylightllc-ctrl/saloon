/**
 * Common questions answered without anyone (owner, 2026-10-12: "a free way"): Help & support and Contact us list them,
 * and while someone types, the matching ones come up just above the message box.
 */
import { createOwner } from './support/api';
import { expect, test } from './support/fixtures';
import { chooseType, id, ownerOn, tab, text } from './support/ui';

test('a salon owner finds the answer in the common questions before writing', async ({
  page,
  mode,
}) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-support').click();
  await expect(text(page, 'Common questions')).toBeVisible();
  await id(page, 'faq-forgotPassword').click();
  await expect(id(page, 'faq-forgotPassword-answer')).toContainText('Forgot password?');

  await id(page, 'support-input').fill('the receipt is not printing');
  await expect(text(page, 'These might answer it')).toBeVisible();
  await expect(id(page, 'faq-receipts')).toBeVisible();
  await id(page, 'faq-receipts').click();
  await expect(id(page, 'faq-receipts-answer')).toContainText('Customer receipt');
});

test('a visitor sees the common questions on Contact us, and the price answer while typing', async ({
  page,
  mode,
}) => {
  await chooseType(page, mode);
  await id(page, 'auth-contact').click();
  await expect(id(page, 'faq')).toBeVisible();
  await id(page, 'contact-input').fill('how much does it cost?');
  await expect(id(page, 'faq-price')).toBeVisible();
  await id(page, 'faq-price').click();
  await expect(id(page, 'faq-price-answer')).toContainText('AED 50');
});
