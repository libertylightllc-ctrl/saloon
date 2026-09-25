import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatAt, formatBusinessDate, type BusinessDate } from './dates';

/** Date formatting in the app language (day and month names), digits always Latin. */
export function useDates() {
  const { i18n } = useTranslation();
  const language = i18n.language;
  return useMemo(
    () => ({
      language,
      /** An instant in a branch time zone: `at(sale.created_at, tz, 'd MMM · HH:mm')`. */
      at: (value: Date | string | number, timeZone: string, pattern: string) => formatAt(value, timeZone, pattern, language),
      /** A business date: `day('2026-09-25', 'EEE d MMM')`. */
      day: (date: BusinessDate, pattern: string) => formatBusinessDate(date, pattern, language),
    }),
    [language],
  );
}
