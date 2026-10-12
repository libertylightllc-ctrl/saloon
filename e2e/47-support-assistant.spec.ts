/**
 * Claude answers Help & support first (owner, 2026-10-12). Locally the claude-sink stand-in plays Claude: a password
 * question gets steps, a refund is handed to a person. The platform owner sees "Needs you" and answers; their answer
 * takes the conversation over.
 */
import { createOwner, makePlatformAdmin } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, tab, text } from './support/ui';

test('the AI assistant answers first; a refund goes to a person, who answers in the console', async ({
  page,
  mode,
  device,
}) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-support').click();
  await id(page, 'support-input').fill('My cashier forgot the password');
  await id(page, 'support-send').click();
  const ai = id(page, 'support-message-assistant');
  await expect(ai.first()).toContainText('Forgot password?');
  await expect(ai.first()).toContainText('Saloqo assistant (AI)');

  await id(page, 'support-input').fill('I paid and want a refund');
  await id(page, 'support-send').click();
  await expect(ai.nth(1)).toContainText('A person from the Saloqo team will follow up here.');

  const platform = await createOwner(mode);
  await makePlatformAdmin(platform.email);
  const office = await device();
  await ownerOn(office, mode, platform.email, platform.password);
  await office.goto('/console');
  await id(office, 'console-tab-support').click();
  await expect(id(office, 'console-support-assistant')).toBeVisible();
  const row = id(office, `support-thread-${owner.code}`);
  await expect(row).toContainText('Needs you');
  await row.click();
  await expect(id(office, 'console-support-message-assistant').first()).toContainText(
    'Saloqo assistant (AI)',
  );
  await id(office, 'console-support-input').fill(
    'Hi, this is Sara from Saloqo. I am checking your payment now.',
  );
  await id(office, 'console-support-send').click();
  await expect(text(office, 'Answer sent')).toBeVisible();

  await expect(id(page, 'support-message-support')).toContainText(
    'I am checking your payment now.',
  );
});
