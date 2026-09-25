import { businessDate, dateLocale, formatAt, formatBusinessDate, formatDayLabel } from './dates';

/** Friday 25 September 2026, 10:30 in Dubai. */
const AT = new Date('2026-09-25T06:30:00Z');
const TZ = 'Asia/Dubai';
const NON_LATIN_DIGITS = /[٠-٩۰-۹०-९]/;

describe('day and month names follow the app language', () => {
  it('uses English, Arabic, Hindi and Urdu names', () => {
    expect(formatAt(AT, TZ, 'EEEE d MMMM', 'en')).toBe('Friday 25 September');
    expect(formatAt(AT, TZ, 'EEEE d MMMM', 'ar')).toBe('الجمعة 25 سبتمبر');
    expect(formatAt(AT, TZ, 'EEEE d MMMM', 'hi')).toBe('शुक्रवार 25 सितंबर');
    expect(formatAt(AT, TZ, 'EEEE d MMMM', 'ur')).toBe('جمعہ 25 ستمبر');
  });

  it('short forms used on Home, the date strip and lists', () => {
    expect(formatDayLabel('2026-09-25', 'en')).toBe('Fri 25 Sep');
    expect(formatDayLabel('2026-09-25', 'ar')).toBe('جمعة 25 سبتمبر');
    expect(formatDayLabel('2026-09-25', 'ur')).toBe('جمعہ 25 ستمبر');
    expect(formatBusinessDate('2026-09-01', 'MMMM yyyy', 'ar')).toBe('سبتمبر 2026');
  });

  it('keeps digits Latin in every language and pattern', () => {
    const patterns = ['EEEE d MMMM yyyy', 'dd MMM yyyy HH:mm', 'd MMM · HH:mm', 'HH:mm', 'd', 'do MMMM', 'h:mm a'];
    for (const language of ['en', 'ar', 'hi', 'ur']) {
      for (const pattern of patterns) {
        const text = formatAt(AT, TZ, pattern, language);
        expect(text).not.toMatch(NON_LATIN_DIGITS);
      }
    }
    expect(formatAt(AT, TZ, 'dd MMM yyyy HH:mm', 'hi')).toBe('25 सित 2026 10:30');
  });

  it('shows the branch time, not the phone time', () => {
    // 21:30 UTC on the 24th is already Friday the 25th in Dubai.
    expect(formatAt(new Date('2026-09-24T21:30:00Z'), TZ, 'EEE d MMM HH:mm', 'ar')).toBe('جمعة 25 سبتمبر 01:30');
  });

  it('falls back to English for other languages, and keeps machine dates untouched', () => {
    expect(dateLocale('fr').code).toBe('en-GB');
    expect(dateLocale('ar-AE').code).toBe('ar');
    expect(formatAt(AT, TZ, 'EEE d MMM', undefined)).toBe('Fri 25 Sep');
    // Stored business dates never use a locale.
    expect(businessDate(AT, TZ)).toBe('2026-09-25');
  });
});
