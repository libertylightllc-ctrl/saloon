/**
 * Urdu for date-fns, which ships no `ur` locale: month and day names (Pakistan/Gulf usage),
 * everything else from en-GB. Digits are made Latin by the formatter, per the design system.
 */
import type { Day, Locale, Month } from 'date-fns';
import { enGB } from 'date-fns/locale';

const MONTHS = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
const DAYS = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];

export const ur: Locale = {
  ...enGB,
  code: 'ur',
  localize: {
    ...enGB.localize,
    // Urdu has no customary short forms, so abbreviated and wide names are the same.
    month: (month: Month) => MONTHS[month]!,
    day: (day: Day) => DAYS[day]!,
    dayPeriod: (period: string) => (period === 'am' || period === 'morning' ? 'قبل دوپہر' : 'بعد دوپہر'),
  },
  options: { weekStartsOn: 1, firstWeekContainsDate: 4 },
};
