/**
 * Common questions answered without anyone (owner, 2026-10-12: "a free way"): Help & support and Contact us list them,
 * and while someone types, the matching ones come up just above the message box.
 */
import { createOwner, createStaff } from './support/api';
import { expect, test } from './support/fixtures';
import { chooseType, id, ownerOn, staffOn, tab, text } from './support/ui';

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

// Each login sees the questions that fit it (owner's app check E6).
test('a stylist and an accountant see only the questions that fit their login', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const stylist = await createStaff(owner, 'staff');
  const accountant = await createStaff(owner, 'accountant');

  await staffOn(page, mode, owner.code, stylist.username, stylist.password);
  await tab(page, 'more');
  await id(page, 'more-support').click();
  await expect(id(page, 'faq-clockIn')).toBeVisible();
  await expect(id(page, 'faq-myPay')).toBeVisible();
  await id(page, 'faq-myPay').click();
  await expect(id(page, 'faq-myPay-answer')).toContainText('My pay');
  for (const owners of ['price', 'payPlan', 'addStaff', 'refund', 'deleteAccount', 'staffPassword']) {
    await expect(id(page, `faq-${owners}`)).toHaveCount(0);
  }
  // Typing about a refund does not bring up the owner's answer either.
  await id(page, 'support-input').fill('how do I refund a sale');
  await expect(id(page, 'faq-refund')).toHaveCount(0);

  const books = await device();
  await staffOn(books, mode, owner.code, accountant.username, accountant.password);
  await tab(books, 'more');
  await id(books, 'more-support').click();
  await expect(id(books, 'faq-books')).toBeVisible();
  await expect(id(books, 'faq-staffPassword')).toHaveCount(0);
  await expect(id(books, 'faq-addStaff')).toHaveCount(0);
});
