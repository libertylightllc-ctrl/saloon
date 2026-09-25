import { createOwner, createStaff } from './support/api';
import { expect, test, THEME } from './support/fixtures';
import { expectTheme, id, ownerOn, snap, staffOn, tab, text } from './support/ui';

test('switching the branch type re-themes and re-words every signed-in phone', async ({ page, mode, device }) => {
  const other = mode === 'gents' ? 'ladies' : 'gents';
  const owner = await createOwner(mode);
  const cashier = await createStaff(owner, 'cashier');

  await ownerOn(page, mode, owner.email, owner.password);
  const phone = await device();
  await staffOn(phone, mode, owner.code, cashier.username, cashier.password);
  await tab(phone, 'queue');
  await id(phone, 'queue-new').click();
  await expect(text(phone, THEME[mode].anyStaff)).toBeVisible();
  await expectTheme(phone, mode);

  await tab(page, 'more');
  await id(page, 'more-branch').click();
  await expect(id(page, `branch-mode-${mode}`)).toHaveAttribute('aria-checked', 'true');
  await id(page, `branch-mode-${other}`).click();
  await id(page, 'branch-mode-confirm').click();
  await expect(text(page, /^Switched to/)).toBeVisible();

  // The cashier's phone follows without signing out: colours and wording.
  await expect(text(phone, THEME[other].anyStaff)).toBeVisible({ timeout: 5_000 });
  await expect(text(phone, THEME[mode].anyStaff)).toHaveCount(0);
  await phone.getByRole('button', { name: 'Back' }).filter({ visible: true }).first().click();
  await expectTheme(phone, other);
  await snap(phone, 'after-switch', mode);
  // So does the owner's.
  await expect(id(page, 'branch-save')).toHaveCSS('background-color', THEME[other].primaryAction);

  // And back again.
  await id(page, `branch-mode-${mode}`).click();
  await id(page, 'branch-mode-confirm').click();
  await expectTheme(phone, mode);
  await expect(id(page, 'branch-save')).toHaveCSS('background-color', THEME[mode].primaryAction);
});
