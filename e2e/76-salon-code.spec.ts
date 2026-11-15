/** Owner's app check F3: the owner changes the salon code once, after a warning; staff then sign in with the new code
 * (same username and password), the old code no longer works, and the code cannot be changed a second time. */
import { createOwner, createStaff } from './support/api';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { back, chooseType, field, id, ownerOn, snap, staffOn, tab, text } from './support/ui';

test('the owner changes the salon code once and staff sign in with the new one', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const stylist = await createStaff(owner, 'staff');
  const next = `new${uid().slice(-6)}`.toLowerCase();

  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-staff').click();
  await expect(id(page, 'team-salon-code')).toHaveText(owner.code);
  await id(page, 'salon-code-change').click();
  await expect(id(page, 'salon-code-warning')).toContainText('Every staff member must sign in with the new code.');
  await expect(text(page, `Now: ${owner.code}`)).toBeVisible();
  // Badly formed: the button waits; the current code is refused by the server.
  await id(page, 'salon-code-new').fill('ab c');
  await expect(id(page, 'salon-code-save')).toBeDisabled();
  await id(page, 'salon-code-new').fill(owner.code.toUpperCase());
  await id(page, 'salon-code-save').click();
  await expect(id(page, 'form-error')).toContainText('That is the salon code now.');
  await snap(page, 'salon-code-change', mode);
  await id(page, 'salon-code-new').fill(next.toUpperCase());
  await id(page, 'salon-code-save').click();
  await expect(text(page, `Salon code changed to ${next}. Tell your staff.`)).toBeVisible();
  await expect(id(page, 'team-salon-code')).toHaveText(next);
  // Once only.
  await expect(id(page, 'salon-code-change')).toHaveCount(0);
  await expect(id(page, 'salon-code-changed')).toContainText("It can't be changed again.");
  await back(page);
  await expect(id(page, 'more-salon-code')).toContainText(next);

  // The stylist's old code no longer finds the login; the new one does, with the same username and password.
  const phone = await device();
  await chooseType(phone, mode);
  await id(phone, 'sign-in-as-staff').click();
  await field(phone, 'salonCode').fill(owner.code);
  await field(phone, 'username').fill(stylist.username);
  await field(phone, 'password').fill(stylist.password);
  await id(phone, 'sign-in-submit').click();
  await expect(id(phone, 'form-error')).toBeVisible();
  await expect(id(phone, 'tab-index')).toHaveCount(0);

  const later = await device();
  await staffOn(later, mode, next, stylist.username, stylist.password);
  await expect(id(later, 'tab-index')).toBeVisible();
});
