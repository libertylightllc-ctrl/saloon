/** Platform console, Part A (owner's brief, 24 Nov 2026).
 * A1 a deleted owner is "Owner account deleted on <date>", never an ID; A2 duplicates name the other salon with its
 * code, and deleted accounts are nobody's duplicate; A3 the Overview's numbers follow one rule and add up; A4 plan
 * payments open as a list and a payment is marked Test with a reason, recorded in Changes; A5 a payment says how much
 * paid time is stacked; A6 a closed salon says when, why and by whom; A9 a salon's events at its own time and place.
 * A10 payroll: worked out early with a warning, approved early only with a reason. */
import { format, parseISO } from 'date-fns';

import { admin, createOwner, dubaiDate, KUWAIT, makePlatformAdmin, sellCustom } from './support/api';
import { uid } from './support/env';
import { expect, test } from './support/fixtures';
import { approvePayroll, id, ownerOn, snap, text } from './support/ui';

/** Today as the console shows it, "24 Nov 2026", on a salon's clock. */
const today = (zone = 'Asia/Dubai') =>
  format(parseISO(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())), 'd MMM yyyy');

test('console Part A: deleted owners, duplicates, numbers that add up, payments marked and stacked, closed salons', async ({ page, mode }) => {
  const n = uid().slice(-6);
  const dev = await createOwner(mode);
  await makePlatformAdmin(dev.email);

  // A1: an owner who deleted their account (what the delete-account function does).
  const gone = await createOwner(mode, { businessName: `Gone ${mode} ${n}` });
  const goneId = (await gone.client.auth.getUser()).data.user?.id;
  if (!goneId) throw new Error('no user');
  const { error: dataError } = await admin.rpc('delete_account_data', { p_user: goneId });
  if (dataError) throw dataError;
  const { error: userError } = await admin.auth.admin.deleteUser(goneId, true);
  if (userError) throw userError;

  // A2: two salons with one name, whose owners have the same name.
  const twinA = await createOwner(mode, { businessName: `Twin ${mode} ${n}` });
  const twinB = await createOwner(mode, { businessName: `Twin ${mode} ${n}` });
  const { error: nameError } = await admin
    .from('members')
    .update({ display_name: `Twin Owner ${n}` })
    .in('business_id', [twinA.businessId, twinB.businessId])
    .eq('role', 'owner');
  if (nameError) throw nameError;

  // A4–A5: 12 months, then 1 more while the first year runs.
  const payer = await createOwner(mode, { businessName: `Payer ${mode} ${n}`, plan: false });
  for (const [months, amount] of [[12, 9_900], [1, 1_000]] as const) {
    const { error } = await dev.client.rpc('admin_activate', { p_business: payer.businessId, p_months: months, p_amount_minor: amount, p_note: 'Bank transfer' });
    if (error) throw error;
  }

  // A6, A9: a salon in Kuwait with a sale, closed below.
  const shut = await createOwner(mode, { businessName: `Shut ${mode} ${n}`, country: KUWAIT });
  await sellCustom(shut.client, shut, { cash: 1_500 });

  // A3: one rule, said on the page; the countries add up to the salons; accounts split three ways.
  await ownerOn(page, mode, dev.email, dev.password);
  await page.goto('/console');
  await expect(id(page, 'console-rule')).toHaveText('Test and closed salons are left out.');
  const salons = Number(await id(page, 'console-salons-value').innerText());
  const countries = await page.locator('[data-testid^="console-country-"]').allInnerTexts();
  expect(countries.reduce((sum, c) => sum + Number(c.match(/(\d+)\s*$/)?.[1] ?? 0), 0)).toBe(salons);
  const accounts = Number(await id(page, 'console-accounts-value').innerText());
  const split = (await id(page, 'console-accounts-sub').innerText()).match(/(\d+) active · (\d+) switched off · (\d+) deleted/);
  expect(split).not.toBeNull();
  expect(Number(split?.[1]) + Number(split?.[2]) + Number(split?.[3])).toBe(accounts);
  expect(Number(split?.[3])).toBeGreaterThan(0);
  await expect(id(page, 'console-new-salons-sub')).toContainText(/\d+ in the last 30 days/);
  await snap(page, 'console-a-overview', mode);

  // A4: this month's plan payments open as a list; the 12-month one is marked Test with a reason.
  await id(page, 'console-plan-income-month').click();
  const payment = id(page, `console-payment-${payer.code}-9900`);
  await expect(payment).toContainText('12 months');
  await payment.click();
  await id(page, 'console-payment-reason').fill('Paid by us to try it');
  await id(page, 'console-payment-test').click();
  await expect(text(page, `Payer ${mode} ${n}: payment marked as test`)).toBeVisible();
  await expect(payment).toContainText('Not counted');
  await expect(payment).toContainText(`Paid by us to try it · by ${dev.name}`);
  await snap(page, 'console-a-payments', mode);

  // A5: the second payment says what is stacked up to it; times on the console's own events say the viewer's city.
  await page.goto('/console');
  await id(page, 'console-tab-plans').click();
  const plans = id(page, `plan-event-activate-Payer ${mode} ${n}`);
  await expect(plans.first()).toContainText('13 months paid in 2 payments');
  await expect(plans.first()).toContainText(/\d{1,2} \w{3} \d{4} · \d{1,2}:\d{2}( [AP]M)? Dubai/);
  await expect(plans.nth(1)).toContainText('Test');

  // Changes: who marked it, and why.
  await id(page, 'console-tab-audit').click();
  await expect(page.locator('[data-testid="audit-payment:mark"]').filter({ hasText: `Payer ${mode} ${n}` })).toContainText(
    'marked Test (Paid by us to try it)',
  );

  // A1: the deleted owner's salon: the day, never an ID or email; not a duplicate.
  await id(page, 'console-tab-salons').click();
  await id(page, 'console-salon-search').fill(gone.code);
  const goneRow = id(page, `admin-salon-${gone.code}`);
  await expect(goneRow).toContainText(`Owner account deleted on ${today()}`);
  await expect(goneRow).toContainText('The owner deleted their account');
  await expect(goneRow).toContainText(`Closed on ${today()}`);
  await expect(goneRow).not.toContainText('@');
  await expect(goneRow).not.toContainText('Possible duplicate');

  // A2: the other salon of the same name, told apart by its code.
  await id(page, 'console-salon-search').fill(twinA.code);
  await expect(id(page, `admin-salon-${twinA.code}`)).toContainText(`Same owner name as Twin ${mode} ${n} (${twinB.code})`);

  // A6: closed with a reason: when, why and by whom, and nothing else about its plan.
  await id(page, 'console-salon-search').fill(shut.code);
  await id(page, `admin-salon-${shut.code}`).click();
  await id(page, 'console-close-reason').fill('Opened by mistake');
  await id(page, 'console-close-salon').click();
  const shutRow = id(page, `admin-salon-${shut.code}`);
  await expect(shutRow).toContainText(`Closed on ${today('Asia/Kuwait')}`);
  await expect(shutRow).toContainText(`Opened by mistake · by ${dev.name}`);
  await expect(shutRow).not.toContainText('Paid until');
  await snap(page, 'console-a-closed', mode);

  // A9: the salon's history at the salon's own time and place.
  await shutRow.click();
  await id(page, 'console-salon-history').click();
  await expect(page.getByText(/Kuwait City$/).first()).toBeVisible();

  // Accounts: the same split as the Overview.
  await id(page, 'console-tab-accounts').click();
  await expect(id(page, 'console-accounts-split')).toContainText(/\d+ active · \d+ switched off · \d+ deleted/);
});

test('payroll A10: worked out early with a warning; approved early only with a reason, kept in the activity', async ({ page, mode }) => {
  const owner = await createOwner(mode);
  await makePlatformAdmin(owner.email);
  const month = dubaiDate().slice(0, 7);
  const lastDay = dubaiDate(1).slice(0, 7) !== month;
  const { error } = await owner.client.rpc('save_employee', {
    p: { business_id: owner.businessId, branch_id: owner.branchId, full_name: 'Sami Early', base_salary_minor: 300_000, started_on: `${month}-01` },
  });
  if (error) throw error;

  await ownerOn(page, mode, owner.email, owner.password);
  await page.goto('/payroll');
  await id(page, 'payroll-generate').click();
  await expect(text(page, 'Payroll worked out')).toBeVisible();
  const monthName = format(parseISO(`${month}-01`), 'MMMM');
  if (lastDay) {
    // The month's last day: no warning, approved as before.
    await expect(id(page, 'payroll-early-warning')).toHaveCount(0);
    await expect(id(page, 'payroll-approve-early')).toHaveCount(0);
    await snap(page, 'payroll-early', mode);
    await approvePayroll(page);
  } else {
    await expect(id(page, 'payroll-early-warning')).toHaveText(`${monthName} isn't over: sales, attendance and leave after today won't be in it.`);
    await expect(id(page, 'payroll-approve')).toHaveCount(0);
    await id(page, 'payroll-approve-early').click();
    await id(page, 'payroll-early-reason').fill('ok');
    await expect(id(page, 'payroll-approve')).toBeDisabled();
    await id(page, 'payroll-early-reason').fill('Checked before the month ends');
    await snap(page, 'payroll-early', mode);
    await id(page, 'payroll-approve').click();
  }
  await expect(text(page, 'Payroll approved and posted to the books')).toBeVisible();

  // The console's Activity for this salon, in the app's words.
  await page.goto('/console');
  await id(page, 'console-tab-salons').click();
  await id(page, 'console-salon-search').fill(owner.code);
  await id(page, `admin-salon-${owner.code}`).click();
  await id(page, 'console-salon-history').click();
  await expect(
    page.getByText(
      lastDay
        ? new RegExp(`^Approved payroll for ${monthName} \\d{4}: net`)
        : new RegExp(`^Approved payroll for ${monthName} \\d{4} before the month ended \\(Checked before the month ends\\): net`),
    ),
  ).toBeVisible();
});
