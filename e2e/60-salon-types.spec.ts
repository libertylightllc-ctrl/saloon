/**
 * Two more salon types (website brief 5.4, 2026-10-23): a new owner picks "Beauty & wellness studio" on the home page
 * and sets up a studio — therapists, its own starter services, treatment rooms for a massage; an existing salon
 * becomes a unisex salon in Branch settings — its look and words change at once.
 */
import { admin, createOwner } from './support/api';
import { expect, test } from './support/fixtures';
import { back, chooseType, field, id, ownerOn, tab, text } from './support/ui';
import { uid } from './support/env';

test('a beauty & wellness studio: picked on the home page, set up with its own services, rooms for a massage', async ({ page }) => {
  const email = `studio-${uid()}@e2e.test`;
  await chooseType(page, 'wellness');
  await id(page, 'link-sign-up').click();
  await field(page, 'name').fill('Studio Owner');
  await field(page, 'email').fill(email);
  await field(page, 'password').fill('Owner1234!');
  await id(page, 'sign-up-submit').click();

  await expect(id(page, 'setup-next')).toBeVisible({ timeout: 30_000 });
  await field(page, 'businessName').fill('Calm Studio');
  await id(page, 'setup-next').click();
  await id(page, 'setup-next').click(); // country: UAE
  // The type picked on the home page is already chosen.
  await expect(id(page, 'setup-mode-wellness')).toBeVisible();
  await expect(id(page, 'setup-mode-unisex')).toBeVisible();
  await id(page, 'setup-next').click();
  await field(page, 'branchName').fill('Marina');
  await id(page, 'setup-next').click();
  await id(page, 'setup-next').click(); // create
  await expect(id(page, 'tab-index')).toBeVisible({ timeout: 30_000 });

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = users.users.find((u) => u.email === email)!;
  const { data: member } = await admin.from('members').select('business_id').eq('user_id', user.id).single();
  const { data: branch } = await admin.from('branches').select('id, mode').eq('business_id', member!.business_id).single();
  expect(branch!.mode).toBe('wellness');
  const { data: rooms } = await admin.from('rooms').select('name').eq('branch_id', branch!.id).order('name');
  expect(rooms!.map((r) => r.name)).toEqual(['Treatment room 1', 'Treatment room 2']);

  // A massage booking asks for a room; the words are a studio's.
  await tab(page, 'queue');
  await id(page, 'queue-new').click();
  await id(page, 'appt-kind-booking').click();
  await id(page, 'pick-service-Swedish Massage').click();
  await expect(text(page, 'Any therapist')).toBeVisible();
  await expect(id(page, 'room-Treatment room 1')).toBeVisible();
});

test('a salon becomes a unisex salon in Branch settings: its look and words change', async ({ page }) => {
  const owner = await createOwner('gents');
  await ownerOn(page, 'gents', owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-branch').click();
  await id(page, 'branch-mode-unisex').click();
  await id(page, 'branch-mode-confirm').click();
  await expect(text(page, 'Switched to Unisex salon')).toBeVisible();
  await expect.poll(async () => (await admin.from('branches').select('mode').eq('id', owner.branchId).single()).data!.mode).toBe('unisex');
  await back(page);
  await tab(page, 'queue');
  await id(page, 'queue-new').click();
  await expect(text(page, 'Any stylist')).toBeVisible();
});
