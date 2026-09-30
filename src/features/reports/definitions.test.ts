import type { TFunction } from 'i18next';

import { buildReport, csvHeader } from './definitions';

const t = ((key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key)) as unknown as TFunction;
const day = (date: string) => date;

describe('buildReport', () => {
  it('monthly: totals the days, compares with last month, lists only active days', () => {
    const view = buildReport(
      {
        type: 'monthly',
        data: {
          month: '2026-09',
          days: [
            { date: '2026-09-01', sales_minor: 10_500, sales: 1, services: 1, refunds_minor: 0, expenses_minor: 1_500 },
            { date: '2026-09-02', sales_minor: 0, sales: 0, services: 0, refunds_minor: 0, expenses_minor: 0 },
            { date: '2026-09-03', sales_minor: 6_250, sales: 1, services: 2, refunds_minor: 2_100, expenses_minor: 0 },
          ],
          revenue_minor: 13_000,
          costs_minor: 1_500,
          prev_revenue_minor: 10_000,
          prev_costs_minor: 2_000,
        },
      },
      { t, day },
    );
    expect(view.kpis.map((k) => [k.key, k.value])).toEqual([
      ['sales', 'AED 167.50'],
      ['revenue', 'AED 130.00'],
      ['costs', 'AED 15.00'],
      ['result', 'AED 115.00'],
    ]);
    expect(view.kpis[1]!.delta).toEqual({ label: '30%', trend: 'up', good: true });
    // Lower costs are good news.
    expect(view.kpis[2]!.delta).toEqual({ label: '25%', trend: 'down', good: true });
    expect(view.rows.map((r) => r.id)).toEqual(['2026-09-01', '2026-09-03']);
    expect(view.rows[1]!.csv).toEqual(['2026-09-03', '62.50', '2', '21.00', '0.00']);
    expect(view.chart.bars).toHaveLength(3);
  });

  it('closing: newest day first; a short day is marked as an error', () => {
    const view = buildReport(
      {
        type: 'closing',
        data: [
          { business_date: '2026-09-01', status: 'approved', expected_minor: 25_000, counted_minor: 24_500, variance_minor: -500, taken_out_minor: 0, reason: 'Coins', counted_by: 'Noor', approved_by: 'Owner' },
          { business_date: '2026-09-02', status: 'open', expected_minor: 20_000, counted_minor: null, variance_minor: null, taken_out_minor: 0, reason: null, counted_by: null, approved_by: null },
        ],
      },
      { t, day },
    );
    expect(view.rows.map((r) => r.id)).toEqual(['2026-09-02', '2026-09-01']);
    expect(view.rows[1]!.tone).toBe('error');
    expect(view.rows[1]!.cells[5]).toBe('Noor → Owner');
    expect(view.kpis[0]!.value).toBe('1 / 2');
    expect(view.rows[0]!.csv.length).toBe(csvHeader('closing', t).length);
  });

  it('every CSV row has as many cells as its header', () => {
    const staff = buildReport(
      { type: 'staff', data: [{ employee_id: 'e1', full_name: 'Rafiq', services: 3, sales_minor: 15_750, revenue_minor: 15_000, commission_minor: 1_300, tips_minor: 1_000, days_worked: 20, late_days: 2 }] },
      { t, day },
    );
    expect(staff.rows[0]!.csv.length).toBe(csvHeader('staff', t).length);
    const customers = buildReport(
      { type: 'customers', data: [{ customer_id: 'c1', name: 'Omar', phone: null, visits: 3, last_visit_at: null, spent_minor: 8_400, month_visits: 1, month_spent_minor: 8_400 }] },
      { t, day },
    );
    expect(customers.rows[0]!.csv.length).toBe(csvHeader('customers', t).length);
  });

  it('vat: output less input is what is due; more input than output is money back', () => {
    const view = buildReport(
      {
        type: 'vat',
        data: [
          { kind: 'sales', entries: 3, taxable_minor: 60_000, vat_minor: 3_000 },
          { kind: 'refunds', entries: 1, taxable_minor: -2_000, vat_minor: -100 },
          { kind: 'purchases', entries: 1, taxable_minor: 4_500, vat_minor: 225 },
          { kind: 'expenses', entries: 1, taxable_minor: 10_000, vat_minor: 500 },
        ],
      },
      { t, day },
    );
    expect(view.kpis.map((k) => [k.key, k.label.split(':')[0], k.value])).toEqual([
      ['output', 'reports.kpi.vatOutput', 'AED 29.00'],
      ['input', 'reports.kpi.vatInput', 'AED 7.25'],
      ['due', 'reports.kpi.vatDue', 'AED 21.75'],
    ]);
    expect(view.rows[1]!.csv).toEqual(['reports.vatKinds.refunds:{}', 1, '-20.00', '-1.00']);
    expect(view.rows[0]!.csv.length).toBe(csvHeader('vat', t).length);

    const refund = buildReport({ type: 'vat', data: [{ kind: 'purchases', entries: 1, taxable_minor: 4_500, vat_minor: 225 }] }, { t, day });
    expect(refund.kpis[2]).toMatchObject({ label: 'reports.kpi.vatRefund:{}', value: 'AED 2.25' });
  });
});
