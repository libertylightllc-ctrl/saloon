/**
 * The website's reports picture (website brief 1.3: the old one showed a losing month): a demo barber shop's
 * October with healthy numbers, captured from the real app. Sales AED 48,250 spread over the month, costs AED 31,400
 * (rent, staff housing, bills…), result + AED 16,850, today's cash close balanced. Writes
 * assets/images/landing/gents-reports.png (convert to the 600 × 1298 WebP with scripts/landing-shots/to-webp.py).
 * Run on the local stack: npx playwright test -c scripts/landing-shots/playwright.config.ts reports
 */
import { admin, createOwner, dubaiDate, sellCustom } from '../../e2e/support/api';
import { expect, test } from '../../e2e/support/fixtures';
import { id, ownerOn } from '../../e2e/support/ui';

const SALES = 4_825_000; // AED 48,250.00
const EXPENSES: [string, number][] = [
  ['rent', 1_500_000],
  ['staff_accommodation', 600_000],
  ['licences', 240_000],
  ['electricity', 145_000],
  ['marketing', 120_000],
  ['staff_welfare', 120_000],
  ['cleaning', 90_000],
  ['transport', 80_000],
  ['tea_food', 62_000],
  ['repairs', 60_000],
  ['internet_phone', 45_000],
  ['uniforms', 40_000],
  ['water', 38_000],
]; // AED 31,400.00
const PRICES = [3_500, 4_500, 5_500, 6_000, 8_000, 9_500, 12_000, 15_000];

test('reports: a healthy month', async ({ page }) => {
  test.setTimeout(900_000);
  const owner = await createOwner('gents', { openingCash: 300_000, businessName: 'Al Barsha Gents' });
  const today = dubaiDate(0);
  const days = Number(today.slice(8, 10));
  const month = today.slice(0, 8);
  // Busier at the weekend (Fri/Sat), a little growth through the month; the day totals add up to the month exactly.
  const weights = Array.from({ length: days }, (_, i) => {
    const dow = new Date(`${month}${String(i + 1).padStart(2, '0')}T12:00:00Z`).getUTCDay();
    return (dow === 5 || dow === 6 ? 1.45 : dow === 0 ? 1.15 : 1) * (1 + i * 0.012);
  });
  const sumW = weights.reduce((a, b) => a + b, 0);
  let left = SALES;
  for (let d = 0; d < days; d += 1) {
    let target = d === days - 1 ? left : Math.round((SALES * weights[d]!) / sumW / 500) * 500;
    left -= target;
    const ids: string[] = [];
    let n = 0;
    while (target > 0) {
      const price = Math.min(PRICES[(d * 7 + n * 3) % PRICES.length]!, target);
      const sale = await sellCustom(owner.client, owner, n % 3 === 0 ? { card: price } : { cash: price });
      ids.push(sale.sale_id);
      target -= price;
      n += 1;
    }
    const date = `${month}${String(d + 1).padStart(2, '0')}`;
    if (date !== today) {
      for (const q of [
        admin.from('sales').update({ business_date: date }).in('id', ids),
        admin.from('journal_entries').update({ business_date: date }).in('source_id', ids),
      ]) {
        const { error } = await q;
        if (error) throw error;
      }
    }
  }
  // The month's costs, paid by bank (rent and the like) or from the till.
  for (const [i, [key, amount]] of EXPENSES.entries()) {
    const { data: cat } = await admin.from('expense_categories').select('id').eq('business_id', owner.businessId).eq('key', key).single();
    const { data, error } = await owner.client.rpc('record_expense', {
      p: { branch_id: owner.branchId, category_id: cat!.id, amount_minor: amount, method: amount > 100_000 ? 'bank' : 'cash', note: key },
    });
    if (error) throw error;
    const expenseId = (data as { expense_id: string }).expense_id;
    const date = `${month}${String(Math.min(1 + i * 2, days)).padStart(2, '0')}`;
    if (date !== today) {
      await admin.from('expenses').update({ business_date: date }).eq('id', expenseId);
      await admin.from('journal_entries').update({ business_date: date }).eq('source_id', expenseId);
    }
  }
  // Today's cash counted and approved: balanced.
  const { data: preview, error: previewError } = await owner.client.rpc('closing_preview', { p_branch: owner.branchId });
  if (previewError) throw previewError;
  const { data: count, error: countError } = await owner.client.rpc('submit_cash_count', {
    p: { branch_id: owner.branchId, counted_cash_minor: (preview as { expected_cash_minor: number }).expected_cash_minor, submit: true, drawer_closed_confirmed: true },
  });
  if (countError) throw countError;
  const closingId = (count as { id?: string; closing_id?: string }).closing_id ?? (count as { id?: string }).id;
  if (closingId) await owner.client.rpc('approve_cash_closing', { p_id: closingId });

  // A salon that keeps its papers: every required licence and permit on file, valid for a year, with a photo.
  const { data: slots } = await owner.client.rpc('compliance_status', { p_business: owner.businessId });
  const missing = ((slots ?? []) as { doc_type: string; holder_type: string; branch_id: string | null; employee_id: string | null; status: string }[])
    .filter((x) => x.status !== 'valid');
  if (missing.length) {
    const year = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);
    const { error } = await admin.from('compliance_documents').insert(
      missing.map((x, i) => ({
        business_id: owner.businessId, branch_id: x.branch_id, employee_id: x.employee_id, holder_type: x.holder_type,
        doc_type: x.doc_type, number: `D-${1000 + i}`, issued_on: `${month}01`, expires_on: year, reminder_days: 30,
        evidence_path: `${owner.businessId}/compliance/demo-${i}.jpg`, active: true, version: 1,
      })),
    );
    if (error) throw error;
  }

  await ownerOn(page, 'gents', owner.email, owner.password);
  await page.goto('/reports');
  await expect(id(page, 'report-kpi-sales-value')).toContainText('48,250');
  await expect(page.getByText('Compliance issues: 0')).toBeVisible();
  await page.waitForTimeout(2500); // the chart draws in
  await page.screenshot({ path: 'assets/images/landing/gents-reports.png' });
});
