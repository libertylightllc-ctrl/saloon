/**
 * Help & support chat (owner, 2026-10-12): an owner writes from the app and a visitor from the sign-in screen; the
 * platform owner sees who wrote and from where in the console and answers; the owner is notified, the visitor reads
 * the answer when they come back on the same device.
 */
import { createOwner, makePlatformAdmin } from './support/api';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { chooseType, id, ownerOn, tab, text } from './support/ui';

test('an owner writes to support; the platform owner answers in the console; the owner is told and reads it', async ({
  page,
  mode,
  device,
}) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'queue');
  await tab(page, 'more');
  await id(page, 'more-support').click();
  await id(page, 'support-input').fill('The receipt does not print');
  await id(page, 'support-send').click();
  await expect(id(page, 'support-message-user')).toContainText('The receipt does not print');

  const platform = await createOwner(mode);
  await makePlatformAdmin(platform.email);
  const office = await device();
  await ownerOn(office, mode, platform.email, platform.password);
  await office.goto('/console');
  await id(office, 'console-tab-support').click();
  const row = id(office, `support-thread-${owner.code}`);
  await expect(row).toContainText(owner.name);
  await expect(row).toContainText('The receipt does not print');
  await expect(row).toContainText('/queue'); // the screen before Help
  await expect(row).toContainText('1 new');
  await row.click();
  await id(office, 'console-support-input').fill('Thanks, fixed now. Try again.');
  await id(office, 'console-support-send').click();
  await expect(text(office, 'Answer sent')).toBeVisible();

  // The owner: the answer shows in the open chat, and in the bell.
  await expect(id(page, 'support-message-support')).toContainText('Thanks, fixed now.');
  await page.goto('/notifications');
  await expect(text(page, 'Saloqo support answered')).toBeVisible();
});

test('a visitor who cannot sign in writes from the sign-in screen and reads the answer on the same device', async ({
  page,
  mode,
  device,
}) => {
  const email = `visitor-${uid()}@e2e.test`;
  await chooseType(page, mode);
  await id(page, 'auth-contact').click();
  await id(page, 'contact-input').fill('I forgot my salon code');
  await id(page, 'contact-send').click();
  await expect(text(page, 'Enter a name.')).toBeVisible();
  await id(page, 'contact-name').fill('Omar Visitor');
  await id(page, 'contact-email').fill(email);
  await id(page, 'contact-send').click();
  await expect(id(page, 'contact-message-user')).toContainText('I forgot my salon code');
  await expect(id(page, 'contact-name')).toHaveCount(0);

  const platform = await createOwner(mode);
  await makePlatformAdmin(platform.email);
  const office = await device();
  await ownerOn(office, mode, platform.email, platform.password);
  await office.goto('/console');
  await id(office, 'console-tab-support').click();
  const row = id(office, `support-thread-${email}`);
  await expect(row).toContainText('Not signed in');
  await row.click();
  await id(office, 'console-support-input').fill('Your salon code is on the owner’s More page.');
  await id(office, 'console-support-send').click();
  await expect(text(office, 'Answer sent')).toBeVisible();

  // Back on the same device later: the answer is there.
  await page.reload();
  await expect(id(page, 'contact-message-support')).toContainText(
    'Your salon code is on the owner’s More page.',
  );
});
