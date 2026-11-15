import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { clockPattern } from './clock';
import { dayOf, formatAt, formatBusinessDate, type BusinessDate } from './dates';

/** Date formatting in the app language (day and month names), digits always Latin. */
export function useDates() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  return useMemo(
    () => ({
      language,
      /** An instant in a branch time zone: `at(sale.created_at, tz, 'd MMM · HH:mm')`. */
      // Times in the person's own clock (12- or 24-hour, as their device is set).
      at: (value: Date | string | number, timeZone: string, pattern: string) => formatAt(value, timeZone, clockPattern(pattern), language),
      /** A business date: `day('2026-09-25', 'EEE d MMM')`. */
      day: (date: BusinessDate, pattern: string) => formatBusinessDate(date, pattern, language),
      /** When something happened: "Today · 3:56 PM", "Yesterday · 12:02 AM", "31 Oct · 3:56 PM" (another year: "31 Oct 2025 · …"). */
      when: (value: Date | string | number, timeZone: string) => {
        const time = formatAt(value, timeZone, clockPattern('HH:mm'), language);
        switch (dayOf(value, timeZone)) {
          case 'today':
            return t('common.todayAt', { time });
          case 'yesterday':
            return t('common.yesterdayAt', { time });
          case 'thisYear':
            return formatAt(value, timeZone, clockPattern('d MMM · HH:mm'), language);
          default:
            return formatAt(value, timeZone, clockPattern('d MMM yyyy · HH:mm'), language);
        }
      },
    }),
    [language, t],
  );
}
