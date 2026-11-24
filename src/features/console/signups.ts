/**
 * B8 New sign-ups (owner's brief, Part B): each week's new salons stacked by country. The five countries with the
 * most salons over the 12 weeks are named and the rest are "Other" (no "Other" for a single country: it is named).
 */
import type { Signups } from './overviewApi';

export const OTHER = 'other';
const TOP = 5;

export interface Series {
  /** A country code, or OTHER. */
  code: string;
  total: number;
}

export interface WeekBar {
  week: string;
  total: number;
  /** One per series, in the series' order (0 when none). */
  parts: number[];
}

export function stackSignups(s: Signups): { series: Series[]; weeks: WeekBar[]; total: number } {
  const totals = new Map<string, number>();
  for (const c of s.counts) totals.set(c.country_code, (totals.get(c.country_code) ?? 0) + c.salons);
  const ranked = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const named = ranked.length <= TOP + 1 ? ranked : ranked.slice(0, TOP);
  const other = ranked.slice(named.length).reduce((sum, [, n]) => sum + n, 0);
  const series: Series[] = [...named.map(([code, total]) => ({ code, total })), ...(other > 0 ? [{ code: OTHER, total: other }] : [])];
  const index = new Map(named.map(([code], i) => [code, i]));
  const weeks = s.weeks.map((week) => {
    const parts = series.map(() => 0);
    for (const c of s.counts) {
      if (c.week !== week) continue;
      parts[index.get(c.country_code) ?? series.length - 1]! += c.salons;
    }
    return { week, total: parts.reduce((a, b) => a + b, 0), parts };
  });
  return { series, weeks, total: series.reduce((a, b) => a + b.total, 0) };
}
