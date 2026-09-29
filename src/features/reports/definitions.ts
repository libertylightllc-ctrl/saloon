/**
 * Each report as one description: summary figures, a chart, and a table. The screen, the PDF and the CSV
 * are all drawn from it, so they always show the same numbers.
 */
import type { TFunction } from 'i18next';

import type { CsvCell } from '@/lib/exportFile';
import { formatAmount, formatBps, formatMoney, sum } from '@/lib/money';

import type { ReportData } from './api';

export interface ReportKpi {
  key: string;
  label: string;
  value: string;
  /** vs last month, where there is one. */
  delta?: { label: string; trend: 'up' | 'down'; good: boolean };
}
export interface ReportColumn {
  label: string;
  /** Numbers line up on the end edge. */
  numeric?: boolean;
}
export interface ReportRow {
  id: string;
  cells: string[];
  /** Plain values for the CSV: money as 105.00, dates as 2026-09-25. */
  csv: CsvCell[];
  tone?: 'error' | 'warning';
}
export interface ReportView {
  kpis: ReportKpi[];
  chart: { title: string; bars: { label: string; value: number }[]; money: boolean };
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Shown when the table is empty. */
  empty: string;
}

interface Helpers {
  t: TFunction;
  day: (date: string, pattern: string) => string;
}

const csvMoney = (minor: number | null) => (minor === null ? '' : formatAmount(minor, undefined, { grouping: false }));
const qty = (n: number) => String(Math.round(n * 1000) / 1000);

function change(now: number, before: number, upIsGood: boolean) {
  if (before === 0) return undefined;
  const bps = Math.round(((now - before) * 10_000) / Math.abs(before));
  return { label: formatBps(Math.abs(bps)), trend: bps >= 0 ? ('up' as const) : ('down' as const), good: bps >= 0 === upIsGood };
}

export function buildReport(report: ReportData, { t, day }: Helpers): ReportView {
  const R = (key: string, values?: Record<string, unknown>) => t(`reports.${key}` as 'reports.title', values ?? {}) as string;
  switch (report.type) {
    case 'monthly': {
      const r = report.data;
      const result = r.revenue_minor - r.costs_minor;
      const prevResult = r.prev_revenue_minor - r.prev_costs_minor;
      const active = r.days.filter((d) => d.sales || d.refunds_minor || d.expenses_minor);
      return {
        kpis: [
          { key: 'sales', label: R('kpi.sales'), value: formatMoney(sum(r.days.map((d) => d.sales_minor))) },
          { key: 'revenue', label: R('kpi.revenue'), value: formatMoney(r.revenue_minor), delta: change(r.revenue_minor, r.prev_revenue_minor, true) },
          { key: 'costs', label: R('kpi.costs'), value: formatMoney(r.costs_minor), delta: change(r.costs_minor, r.prev_costs_minor, false) },
          { key: 'result', label: R('kpi.result'), value: formatMoney(result), delta: change(result, prevResult, true) },
        ],
        chart: { title: R('chart.salesByDay'), money: true, bars: r.days.map((d) => ({ label: day(d.date, 'd'), value: d.sales_minor })) },
        columns: [{ label: R('col.date') }, { label: R('col.sales'), numeric: true }, { label: R('col.services'), numeric: true }, { label: R('col.refunds'), numeric: true }, { label: R('col.expenses'), numeric: true }],
        rows: active.map((d) => ({
          id: d.date,
          cells: [day(d.date, 'EEE d MMM'), formatMoney(d.sales_minor), qty(d.services), formatMoney(d.refunds_minor), formatMoney(d.expenses_minor)],
          csv: [d.date, csvMoney(d.sales_minor), qty(d.services), csvMoney(d.refunds_minor), csvMoney(d.expenses_minor)],
        })),
        empty: R('empty.monthly'),
      };
    }
    case 'staff': {
      const rows = report.data;
      return {
        kpis: [
          { key: 'sales', label: R('kpi.sales'), value: formatMoney(sum(rows.map((r) => r.sales_minor))) },
          { key: 'services', label: R('kpi.services'), value: qty(rows.reduce((n, r) => n + r.services, 0)) },
          { key: 'commission', label: R('kpi.commission'), value: formatMoney(sum(rows.map((r) => r.commission_minor))) },
          { key: 'tips', label: R('kpi.tips'), value: formatMoney(sum(rows.map((r) => r.tips_minor))) },
        ],
        chart: { title: R('chart.salesByPerson'), money: true, bars: rows.map((r) => ({ label: r.full_name, value: r.sales_minor })) },
        columns: [{ label: R('col.person') }, { label: R('col.services'), numeric: true }, { label: R('col.sales'), numeric: true }, { label: R('col.revenue'), numeric: true }, { label: R('col.commission'), numeric: true }, { label: R('col.tips'), numeric: true }, { label: R('col.days'), numeric: true }],
        rows: rows.map((r) => ({
          id: r.employee_id,
          cells: [r.full_name, qty(r.services), formatMoney(r.sales_minor), formatMoney(r.revenue_minor), formatMoney(r.commission_minor), formatMoney(r.tips_minor), R('daysLate', { days: r.days_worked, late: r.late_days })],
          csv: [r.full_name, qty(r.services), csvMoney(r.sales_minor), csvMoney(r.revenue_minor), csvMoney(r.commission_minor), csvMoney(r.tips_minor), r.days_worked, r.late_days],
        })),
        empty: R('empty.staff'),
      };
    }
    case 'closing': {
      const rows = report.data;
      const closed = rows.filter((r) => r.status === 'approved');
      return {
        kpis: [
          { key: 'closed', label: R('kpi.daysClosed'), value: `${closed.length} / ${rows.length}` },
          { key: 'difference', label: R('kpi.difference'), value: formatMoney(sum(rows.map((r) => r.variance_minor ?? 0))) },
          { key: 'banked', label: R('kpi.takenOut'), value: formatMoney(sum(rows.map((r) => r.taken_out_minor))) },
        ],
        chart: { title: R('chart.differenceByDay'), money: true, bars: rows.map((r) => ({ label: day(r.business_date, 'd'), value: r.variance_minor ?? 0 })) },
        columns: [{ label: R('col.date') }, { label: R('col.status') }, { label: R('col.expected'), numeric: true }, { label: R('col.counted'), numeric: true }, { label: R('col.difference'), numeric: true }, { label: R('col.by') }],
        rows: rows
          .slice()
          .reverse()
          .map((r) => ({
            id: r.business_date,
            cells: [day(r.business_date, 'EEE d MMM'), R(`status.${r.status}`), formatMoney(r.expected_minor), r.counted_minor === null ? '—' : formatMoney(r.counted_minor), r.variance_minor === null ? '—' : formatMoney(r.variance_minor), [r.counted_by, r.approved_by].filter(Boolean).join(' → ')],
            csv: [r.business_date, r.status, csvMoney(r.expected_minor), csvMoney(r.counted_minor), csvMoney(r.variance_minor), r.counted_by, r.approved_by, r.reason],
            tone: r.variance_minor ? (r.variance_minor < 0 ? 'error' : 'warning') : undefined,
          })),
        empty: R('empty.closing'),
      };
    }
    case 'stock': {
      const rows = report.data;
      return {
        kpis: [
          { key: 'items', label: R('kpi.items'), value: String(rows.length) },
          { key: 'value', label: R('kpi.stockValue'), value: formatMoney(sum(rows.map((r) => r.value_minor))) },
          { key: 'used', label: R('kpi.itemsOut'), value: String(rows.filter((r) => r.qty_out < 0).length) },
        ],
        chart: {
          title: R('chart.valueByItem'),
          money: true,
          bars: rows.slice().sort((a, b) => b.value_minor - a.value_minor).slice(0, 8).map((r) => ({ label: r.name, value: r.value_minor })),
        },
        columns: [{ label: R('col.item') }, { label: R('col.start'), numeric: true }, { label: R('col.in'), numeric: true }, { label: R('col.out'), numeric: true }, { label: R('col.end'), numeric: true }, { label: R('col.value'), numeric: true }],
        rows: rows.map((r) => ({
          id: r.item_id,
          cells: [r.name, qty(r.opening), `+${qty(r.qty_in)}`, qty(r.qty_out), `${qty(r.closing)} ${r.unit}`, formatMoney(r.value_minor)],
          csv: [r.name, r.kind, r.unit, qty(r.opening), qty(r.qty_in), qty(r.qty_out), qty(r.closing), csvMoney(r.value_minor)],
          tone: r.closing < 0 ? 'error' : undefined,
        })),
        empty: R('empty.stock'),
      };
    }
    case 'shortages': {
      const rows = report.data;
      const short = rows.filter((r) => r.variance_minor < 0);
      return {
        kpis: [
          { key: 'count', label: R('kpi.shortDays'), value: String(short.length) },
          { key: 'short', label: R('kpi.totalShort'), value: formatMoney(sum(short.map((r) => r.variance_minor))) },
          { key: 'over', label: R('kpi.totalOver'), value: formatMoney(sum(rows.filter((r) => r.variance_minor > 0).map((r) => r.variance_minor))) },
        ],
        chart: { title: R('chart.differenceByDay'), money: true, bars: rows.map((r) => ({ label: day(r.business_date, 'd MMM'), value: r.variance_minor })) },
        columns: [{ label: R('col.date') }, { label: R('col.difference'), numeric: true }, { label: R('col.reason') }, { label: R('col.by') }],
        rows: rows.map((r) => ({
          id: r.business_date,
          cells: [day(r.business_date, 'EEE d MMM'), formatMoney(r.variance_minor), r.reason ?? '—', [r.counted_by, r.approved_by].filter(Boolean).join(' → ')],
          csv: [r.business_date, r.status, csvMoney(r.variance_minor), r.reason, r.counted_by, r.approved_by],
          tone: r.variance_minor < 0 ? 'error' : 'warning',
        })),
        empty: R('empty.shortages'),
      };
    }
    case 'customers': {
      const rows = report.data;
      const month = rows.filter((r) => r.month_visits > 0);
      return {
        kpis: [
          { key: 'customers', label: R('kpi.customers'), value: String(rows.length) },
          { key: 'visitors', label: R('kpi.cameThisMonth'), value: String(month.length) },
          { key: 'spent', label: R('kpi.spentThisMonth'), value: formatMoney(sum(month.map((r) => r.month_spent_minor))) },
        ],
        chart: {
          title: R('chart.topCustomers'),
          money: true,
          bars: month.slice().sort((a, b) => b.month_spent_minor - a.month_spent_minor).slice(0, 8).map((r) => ({ label: r.name, value: r.month_spent_minor })),
        },
        columns: [{ label: R('col.customer') }, { label: R('col.visits'), numeric: true }, { label: R('col.spent'), numeric: true }, { label: R('col.thisMonth'), numeric: true }],
        rows: rows.map((r) => ({
          id: r.customer_id,
          cells: [r.phone ? `${r.name} · ${r.phone}` : r.name, String(r.visits), formatMoney(r.spent_minor), formatMoney(r.month_spent_minor)],
          csv: [r.name, r.phone, r.visits, r.last_visit_at ?? '', csvMoney(r.spent_minor), r.month_visits, csvMoney(r.month_spent_minor)],
        })),
        empty: R('empty.customers'),
      };
    }
  }
}

/** CSV header row: the CSV sometimes carries more columns than the screen (reasons, both names, kind). */
export function csvHeader(type: ReportData['type'], t: TFunction): string[] {
  const C = (key: string) => t(`reports.col.${key}` as 'reports.title') as string;
  switch (type) {
    case 'monthly':
      return [C('date'), C('sales'), C('services'), C('refunds'), C('expenses')];
    case 'staff':
      return [C('person'), C('services'), C('sales'), C('revenue'), C('commission'), C('tips'), C('daysWorked'), C('lateDays')];
    case 'closing':
      return [C('date'), C('status'), C('expected'), C('counted'), C('difference'), C('countedBy'), C('approvedBy'), C('reason')];
    case 'stock':
      return [C('item'), C('kind'), C('unit'), C('start'), C('in'), C('out'), C('end'), C('value')];
    case 'shortages':
      return [C('date'), C('status'), C('difference'), C('reason'), C('countedBy'), C('approvedBy')];
    case 'customers':
      return [C('customer'), C('phone'), C('visits'), C('lastVisit'), C('spent'), C('visitsThisMonth'), C('thisMonth')];
  }
}
