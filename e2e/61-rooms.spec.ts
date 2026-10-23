/**
 * The salon's rooms (2026-10-24): an owner of a beauty & wellness studio adds a room, renames it, stops using a starter
 * room; a massage booking offers only the rooms in use. Salon types without rooms show no Rooms section.
 */
import { createOwner } from './support/api';
import { expect, test } from './support/fixtures';
import { back, id, ownerOn, tab, text } from './support/ui';

test('a studio owner adds, renames and stops using rooms; bookings offer the rooms in use', async ({ page }) => {
  const owner = await createOwner('wellness');
  await ownerOn(page, 'wellness', owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-branch').click();
  await expect(id(page, 'rooms')).toBeVisible();
  await expect(id(page, 'room-Treatment room 1')).toBeVisible();

  await id(page, 'room-new-name').fill('Massage room');
  await id(page, 'room-add').click();
  await expect(text(page, 'Room added')).toBeVisible();
  // The same name twice is refused with a reason.
  await id(page, 'room-new-name').fill('massage room');
  await id(page, 'room-add').click();
  await expect(text(page, 'Another room in use already has this name.')).toBeVisible();

  await id(page, 'room-rename-Massage room').click();
  await id(page, 'room-name-Massage room').fill('Deep tissue room');
  await id(page, 'room-save-Massage room').click();
  await expect(text(page, 'Room saved')).toBeVisible();
  await id(page, 'room-toggle-Treatment room 2').click();
  await expect(text(page, 'Room no longer used for bookings')).toBeVisible();
  await expect(id(page, 'room-Treatment room 2')).toContainText('Not in use');

  await back(page);
  await tab(page, 'queue');
  await id(page, 'queue-new').click();
  await id(page, 'appt-kind-booking').click();
  await id(page, 'pick-service-Swedish Massage').click();
  await expect(id(page, 'room-Deep tissue room')).toBeVisible();
  await expect(id(page, 'room-Treatment room 1')).toBeVisible();
  await expect(id(page, 'room-Treatment room 2')).toHaveCount(0);
});

test('a barber shop has no Rooms section', async ({ page }) => {
  const owner = await createOwner('gents');
  await ownerOn(page, 'gents', owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-branch').click();
  await expect(id(page, 'branch-save')).toBeVisible();
  await expect(id(page, 'rooms')).toHaveCount(0);
});
