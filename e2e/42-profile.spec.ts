/**
 * Everyone edits their own profile (owner, 2026-10-06): name and phone (a staff member's also change in the salon's
 * staff list), the salon's name for the owner, and the password once the current one is given.
 */
import { admin, createOwner, createStaff, userClient } from './support/api';
import { expect, test } from './support/fixtures';
import { back, id, ownerOn, snap, staffOn, tab, text } from './support/ui';

test('an owner edits their name, phone, the salon name and their password', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-profile').click();

  // Name and phone; a phone with letters is refused before it is sent.
  await id(page, 'profile-name').fill('Layla Haddad');
  await id(page, 'profile-phone').fill('050 12ab');
  await expect(text(page, 'That phone number does not look right')).toBeVisible();
  await expect(id(page, 'profile-save')).toBeDisabled();
  await id(page, 'profile-phone').fill('+971 50 123 4567');
  await id(page, 'profile-save').click();
  await expect(text(page, 'Profile saved')).toBeVisible();
  const { data: member } = await admin.from('members').select('display_name, phone').eq('business_id', owner.businessId).eq('role', 'owner').single();
  expect(member).toEqual({ display_name: 'Layla Haddad', phone: '+971 50 123 4567' });

  // The salon's name.
  await id(page, 'profile-salon-name').fill('Haddad Grooming Lounge');
  await id(page, 'profile-salon-save').click();
  await expect(text(page, 'Salon name saved')).toBeVisible();
  await snap(page, 'profile', mode);
  const { data: business } = await admin.from('businesses').select('name').eq('id', owner.businessId).single();
  expect(business?.name).toBe('Haddad Grooming Lounge');

  // The password: a wrong current one is refused; the right one changes it.
  await expect(text(page, `You sign in with ${owner.email}`)).toBeVisible();
  await id(page, 'profile-password-current').fill('NotMyPassword1');
  await id(page, 'profile-password-new').fill('Changed5678!');
  await id(page, 'profile-password-save').click();
  await expect(id(page, 'form-error')).toContainText('That is not your current password');
  await id(page, 'profile-password-current').fill(owner.password);
  await id(page, 'profile-password-save').click();
  await expect(text(page, 'Password changed')).toBeVisible();
  await userClient(owner.email, 'Changed5678!'); // throws if the new password does not sign in

  // Back on More, the card shows the new name.
  await back(page);
  await expect(id(page, 'more-name')).toHaveText('Layla Haddad');
});

test('a staff member edits their name and phone, and the salon sees it in Staff', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const staff = await createStaff(owner, 'staff');
  await staffOn(page, mode, owner.code, staff.username, staff.password);
  await tab(page, 'more');
  await id(page, 'more-profile').click();

  // Staff sign in with a username, so there is no email to change and no salon name to edit.
  await expect(text(page, `You sign in with the username ${staff.username} and the salon code ${owner.code}.`)).toBeVisible();
  await expect(id(page, 'profile-email')).toHaveCount(0);
  await expect(id(page, 'profile-salon-name')).toHaveCount(0);

  await id(page, 'profile-name').fill('Omar Siddiqui');
  await id(page, 'profile-phone').fill('+971 55 765 4321');
  await id(page, 'profile-save').click();
  await expect(text(page, 'Profile saved')).toBeVisible();
  const { data: employee } = await admin.from('employees').select('full_name, phone').eq('member_id', staff.memberId).single();
  expect(employee).toEqual({ full_name: 'Omar Siddiqui', phone: '+971 55 765 4321' });
});
