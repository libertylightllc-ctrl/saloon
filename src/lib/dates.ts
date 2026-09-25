/**
 * Business dates. A branch's "business date" is its local calendar date in its own timezone
 * (default Asia/Dubai). Cash closing, reports and "today" all use it — never the phone's
 * timezone and never UTC.
 *
 * Business dates are plain 'YYYY-MM-DD' strings, matching Postgres `date` columns.
 */
import { format, type Locale } from 'date-fns';
import { ar, enGB, hi } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import { ur } from './dateLocales/ur';
import { normalizeDigits } from './money';

export const DEFAULT_TIMEZONE = 'Asia/Dubai';

/** 'YYYY-MM-DD' */
export type BusinessDate = string;
/** 'YYYY-MM' — payroll periods and accounting months. */
export type MonthKey = string;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parts(date: BusinessDate): [number, number, number] {
  const match = DATE_PATTERN.exec(date);
  if (!match || !isBusinessDate(date)) throw new RangeError(`Not a business date: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isBusinessDate(value: string): value is BusinessDate {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** The branch's calendar date at a moment in time. */
export function businessDate(at: Date = new Date(), timeZone = DEFAULT_TIMEZONE): BusinessDate {
  return formatInTimeZone(at, timeZone, 'yyyy-MM-dd');
}

/** Calendar arithmetic on business dates (no timezone involved). */
export function shiftBusinessDate(date: BusinessDate, days: number): BusinessDate {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A wall-clock time on a business date, as a real instant. ('2026-09-22', '15:30') */
export function atBusinessTime(
  date: BusinessDate,
  time: string,
  timeZone = DEFAULT_TIMEZONE,
): Date {
  parts(date);
  if (!TIME_PATTERN.test(time)) throw new RangeError(`Not a time (HH:mm): ${time}`);
  return fromZonedTime(`${date}T${time}:00`, timeZone);
}

/**
 * The instants a business date covers: [start, end). Use for timestamptz queries.
 * Days with a daylight-saving change are 23 or 25 hours long; this handles them.
 */
export function businessDayBounds(
  date: BusinessDate,
  timeZone = DEFAULT_TIMEZONE,
): { start: Date; end: Date } {
  return {
    start: atBusinessTime(date, '00:00', timeZone),
    end: atBusinessTime(shiftBusinessDate(date, 1), '00:00', timeZone),
  };
}

export function monthKey(date: BusinessDate): MonthKey {
  parts(date);
  return date.slice(0, 7);
}

/** Month arithmetic: shiftMonth('2026-01', -1) → '2025-12'. */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = parts(`${month}-01`);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function businessMonth(at: Date = new Date(), timeZone = DEFAULT_TIMEZONE): MonthKey {
  return monthKey(businessDate(at, timeZone));
}

/** Whole minutes from `from` to `to` (negative if `to` is earlier). "waiting 6 min", "in 25 min". */
export function minutesBetween(from: Date, to: Date): number {
  return Math.trunc((to.getTime() - from.getTime()) / 60_000);
}

/** Day and month names follow the app language; unknown languages fall back to English. */
const LOCALES: Record<string, Locale> = { en: enGB, ar, hi, ur };

export function dateLocale(language?: string): Locale {
  return LOCALES[language?.split('-')[0] ?? 'en'] ?? enGB;
}

/**
 * An instant shown in the branch's time zone ("EEE d MMM · HH:mm"), with names in `language`.
 * Digits always come out Latin (02-DESIGN-SYSTEM: numbers are never localised).
 */
export function formatAt(at: Date | string | number, timeZone: string, pattern: string, language?: string): string {
  return normalizeDigits(formatInTimeZone(new Date(at), timeZone, pattern, { locale: dateLocale(language) }));
}

/** A business date ('2026-09-25') with names in `language`; no time zone is involved. */
export function formatBusinessDate(date: BusinessDate, pattern: string, language?: string): string {
  const [y, m, d] = parts(date);
  return normalizeDigits(format(new Date(y, m - 1, d), pattern, { locale: dateLocale(language) }));
}

/** 'Tue 22 Sep' — 'الثلاثاء…' in Arabic; names in `language`, digits Latin. */
export function formatDayLabel(date: BusinessDate, language?: string): string {
  return formatBusinessDate(date, 'EEE d MMM', language);
}
