import { createOwner, createStaff, latestCode } from './support/api';
import { expect, test, THEME } from './support/fixtures';
import { chooseType, field, id, ownerOn, signInOwner, signInStaff, tab, text } from './support/ui';

test('owner: wrong password, no internet, sign out to the themed sign-in, forgot password', async ({ page, mode, context }) => {
  const owner = await createOwner(mode);
  await chooseType(page, mode);

  await field(page, 'email').fill(owner.email);
  await field(page, 'password').fill('not-the-password');
  await id(page, 'sign-in-submit').click();
  await expect(id(page, 'form-error')).toContainText('Wrong email, username or password.');

  await context.setOffline(true);
  await field(page, 'password').fill(owner.password);
  await id(page, 'sign-in-submit').click();
  await expect(id(page, 'form-error')).toContainText('No connection.');
  await context.setOffline(false);

  await signInOwner(page, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'sign-out').click();
  // Back on the sign-in, still in this device's salon theme.
  await expect(id(page, 'sign-in-submit')).toBeVisible();
  await expect(id(page, 'sign-in-submit')).toHaveCSS('background-color', THEME[mode].primaryAction);

  // Forgot password: a 6-digit code by email (local mail catcher), then a new password.
  await id(page, 'link-forgot').click();
  await field(page, 'email').fill(owner.email);
  await id(page, 'forgot-send').click();
  const code = await latestCode(owner.email);
  await field(page, 'code').fill('000000');
  await field(page, 'password').fill('NewPass123!');
  await field(page, 'confirm').fill('NewPass123!');
  await id(page, 'forgot-reset').click();
  await expect(id(page, 'form-error')).toContainText('That code is wrong or expired.');
  await field(page, 'code').fill(code);
  await id(page, 'forgot-reset').click();
  await expect(id(page, 'tab-index')).toBeVisible({ timeout: 30_000 });

  await tab(page, 'more');
  await id(page, 'sign-out').click();
  await field(page, 'email').fill(owner.email);
  await field(page, 'password').fill(owner.password);
  await id(page, 'sign-in-submit').click();
  await expect(id(page, 'form-error')).toContainText('Wrong email, username or password.');
  await signInOwner(page, owner.email, 'NewPass123!');
});

test('staff: wrong password; disabled while signed in → signed out with a clear message', async ({ page, mode, device }) => {
  const owner = await createOwner(mode);
  const staff = await createStaff(owner, 'cashier');

  const phone = await device();
  await chooseType(phone, mode);
  await id(phone, 'sign-in-as-staff').click();
  await field(phone, 'salonCode').fill(owner.code);
  await field(phone, 'username').fill(staff.username);
  await field(phone, 'password').fill('wrong-password');
  await id(phone, 'sign-in-submit').click();
  await expect(id(phone, 'form-error')).toContainText('Wrong email, username or password.');
  await field(phone, 'password').fill(staff.password);
  await id(phone, 'sign-in-submit').click();
  await expect(id(phone, 'tab-index')).toBeVisible({ timeout: 30_000 });

  // The owner disables the login from Team & logins.
  await ownerOn(page, mode, owner.email, owner.password);
  await tab(page, 'more');
  await id(page, 'more-team').click();
  await id(page, `member-${staff.username}`).click();
  await id(page, 'toggle-active').click();
  await expect(text(page, `${staff.name} can no longer sign in`)).toBeVisible();

  // The cashier's phone is signed out and told why.
  await expect(id(phone, 'session-notice')).toContainText('This login is disabled.', { timeout: 10_000 });
  // The sign-in reopens on Staff with the salon code remembered.
  await expect(id(phone, 'sign-in-as-staff')).toHaveAttribute('aria-selected', 'true');
  await expect(field(phone, 'salonCode')).toHaveValue(owner.code);
  await field(phone, 'username').fill(staff.username);
  await field(phone, 'password').fill(staff.password);
  await id(phone, 'sign-in-submit').click();
  await expect(id(phone, 'form-error')).toContainText('This login is disabled.');

  // Enabled again → can sign in.
  await id(page, `member-${staff.username}`).click();
  await id(page, 'toggle-active').click();
  await expect(text(page, `${staff.name} can sign in again`)).toBeVisible();
  await signInStaff(phone, owner.code, staff.username, staff.password);
});
