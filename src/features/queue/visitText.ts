import { useTranslation } from 'react-i18next';

import { minutesBetween } from '@/lib/dates';
import { useDates } from '@/lib/useDates';

import type { Appointment } from './api';

/** "13:48 · waiting 52 min", "14:30 · in 12 min" / "12 min late", "Started 13:48" — a visit's time, as the queue says it. */
export function useVisitWhen() {
  const { t } = useTranslation();
  const dates = useDates();
  return (item: Appointment, now: Date, timeZone: string): string => {
    const time = dates.at(new Date(item.scheduled_at), timeZone, 'HH:mm');
    if (item.status === 'waiting') {
      const since = new Date(item.checked_in_at ?? item.scheduled_at);
      return `${time} · ${t('queue.waitingFor', { minutes: Math.max(0, minutesBetween(since, now)) })}`;
    }
    if (item.status === 'booked') {
      const until = minutesBetween(now, new Date(item.scheduled_at));
      return `${time} · ${until >= 0 ? t('queue.inMinutes', { minutes: until }) : t('queue.late', { minutes: -until })}`;
    }
    if (item.status === 'in_progress' && item.started_at) {
      return t('queue.startedAt', { time: dates.at(new Date(item.started_at), timeZone, 'HH:mm') });
    }
    return time;
  };
}
