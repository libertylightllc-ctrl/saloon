import type { TFunction } from 'i18next';

/**
 * A number of minutes the way people say it: "37 min", "2 h", "11 h 37 min" (owner's app check D2 — "Late 697 min"
 * was hard to read). Hours take their plural form in each language.
 */
export function formatDuration(t: TFunction, minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return t('common.durationM', { count: m });
  if (m === 0) return t('common.durationH', { count: h });
  return t('common.durationHm', { hours: t('common.durationH', { count: h }), minutes: t('common.durationM', { count: m }) });
}
