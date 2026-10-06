/**
 * Removing staff (owner, 2026-10-03): someone with nothing on record goes completely; a barber with sales is archived
 * (hidden, login off, records kept) and can be brought back.
 */
import { admin, createOwner, createStaff, employeeOf, sellCustom, staffEmail, userClient } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, text } from './support/ui';

test('remove a mistaken entry completely; archive a barber with sales, then bring them back', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const barber = await createStaff(owner, 'staff', { name: 'Worked Barber' });
  await sellCustom(owner.client, owner, { cash: 4000, employeeId: await employeeOf(barber.memberId) });
  await owner.client.rpc('save_employee', { p: { business_id: owner.businessId, branch_id: owner.branchId, full_name: 'Typo Name' } });
  await ownerOn(page, mode, owner.email, owner.password);

  // Added by mistake: removed completely.
  await page.goto('/staff');
  await id(page, 'staff-Typo Name').click();
  await id(page, 'staff-remove').click();
  await expect(text(page, 'Remove Typo Name?')).toBeVisible();
  // Live sync drops Typo Name from the staff list as soon as the row goes, which can be before the removal answers
  // (seen in the proof, 2026-10-07: the page lost the person, the sheet with it, and never went back to Staff). The
  // answer is held until that refreshed list has arrived, so the page meets them in that order every time.
  const listWithout = page.waitForResponse(
    async (r) => r.url().includes('/rpc/staff_directory') && !(await r.text()).includes('Typo Name'),
  );
  await page.route('**/functions/v1/remove-staff', async (route) => {
    const answer = await route.fetch();
    await listWithout;
    await route.fulfill({ response: answer });
  });
  await id(page, 'staff-remove-confirm').click();
  await expect(text(page, 'Typo Name removed')).toBeVisible();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(id(page, 'staff-Typo Name')).toHaveCount(0);
  const { count } = await admin.from('employees').select('id', { count: 'exact', head: true }).eq('business_id', owner.businessId).eq('full_name', 'Typo Name');
  expect(count).toBe(0);

  await page.unroute('**/functions/v1/remove-staff');

  // A barber with a sale: archived, login off, the sale keeps its barber.
  await id(page, 'staff-Worked Barber').click();
  await id(page, 'staff-remove').click();
  await id(page, 'staff-remove-confirm').click();
  await expect(text(page, 'Worked Barber archived (records kept)')).toBeVisible();
  await expect(id(page, 'staff-archived')).toBeVisible();
  await expect(userClient(staffEmail(owner.code, barber.username), barber.password)).rejects.toThrow();
  await page.goto('/staff');
  await expect(text(page, 'Archived').first()).toBeVisible();
  await expect(id(page, 'staff-Worked Barber')).toContainText('Archived');

  // Brought back: on the staff and able to sign in again.
  await id(page, 'staff-Worked Barber').click();
  await id(page, 'staff-restore').click();
  await expect(text(page, 'Worked Barber is back on the staff')).toBeVisible();
  await expect(id(page, 'staff-remove')).toBeVisible();
  await expect(userClient(staffEmail(owner.code, barber.username), barber.password)).resolves.toBeTruthy();
});
