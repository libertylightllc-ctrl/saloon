/** Open shifts (owner's app check D1): a shift nobody clocked out of is closed as "No clock-out" once its day has ended,
 * shows in Home → Needs attention, and the owner sets the real time it ended. */
import { admin, createOwner, createStaff, dubaiDate, employeeOf } from './support/api';
import { expect, test } from './support/fixtures';
import { id, ownerOn, text } from './support/ui';

test('a shift left open yesterday is closed as No clock-out and fixed from Home', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  const stylist = await createStaff(owner, 'staff');
  const employee = await employeeOf(stylist.memberId);
  const yesterday = dubaiDate(-1);
  // Clocked in at 21:37 yesterday (no roster), never clocked out.
  const shift = await admin
    .from('attendance')
    .insert({
      business_id: owner.businessId,
      branch_id: owner.branchId,
      employee_id: employee,
      business_date: yesterday,
      clock_in: `${yesterday}T21:37:00+04:00`,
    })
    .select('id')
    .single();
  if (shift.error) throw shift.error;
  // The hourly job (role_alerts) closes it; run the closing step now.
  const closed = await admin.rpc('close_open_shifts');
  if (closed.error) throw closed.error;

  await ownerOn(page, mode, owner.email, owner.password);
  await expect(id(page, 'attention-missed-clock-outs')).toContainText('1 missed clock-out');
  await id(page, 'attention-missed-clock-outs-action').click();
  await expect(id(page, 'missed-clock-outs')).toContainText('Closed at 9:37 PM, no clock-out');
  await id(page, `date-${yesterday}`).click();
  await expect(id(page, `attendance-${stylist.name}`)).toContainText('No clock-out');

  // The owner sets the time they left.
  await id(page, `missed-fix-${stylist.name}`).click();
  await id(page, 'missed-time').fill('21:50');
  await id(page, 'missed-save').click();
  await expect(text(page, `Clock-out saved for ${stylist.name}`)).toBeVisible();
  await expect(id(page, 'missed-clock-outs')).toHaveCount(0);
  await expect(id(page, `attendance-${stylist.name}`)).toContainText('9:50 PM');
  await expect(id(page, `attendance-${stylist.name}`)).not.toContainText('No clock-out');
  const row = await admin.from('attendance').select('no_clock_out, clock_out').eq('id', shift.data.id).single();
  expect(row.data?.no_clock_out).toBe(false);
  expect(new Date(row.data!.clock_out!).toISOString()).toBe(new Date(`${yesterday}T21:50:00+04:00`).toISOString());
});
