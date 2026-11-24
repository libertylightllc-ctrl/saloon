import { useCallback, useMemo } from 'react';

import { useDates } from '@/lib/useDates';

/** The time zone of the device the console is open on: console events are shown in the viewer's time (owner's brief A9). */
export function viewerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dubai';
}

// Zones named after a country, shown by their city.
const CITY: Record<string, string> = {
  'Asia/Qatar': 'Doha',
  'Asia/Bahrain': 'Manama',
  'Asia/Kuwait': 'Kuwait City',
  'Asia/Calcutta': 'Kolkata',
  'Etc/UTC': 'UTC',
  UTC: 'UTC',
};

/** "Asia/Qatar" → "Doha", "America/New_York" → "New York". */
export function zoneCity(zone: string): string {
  return CITY[zone] ?? (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
}

/**
 * A moment with the place whose clock it is read on (owner's brief A9): a salon's events in the salon's own time,
 * "16 Nov 2026 · 11:20 PM Doha"; the console's own events in the viewer's time, with the viewer's city.
 */
export function useConsoleTime() {
  const dates = useDates();
  const mine = useMemo(() => viewerZone(), []);
  const at = useCallback((iso: string, zone: string) => `${dates.at(iso, zone, 'd MMM yyyy · HH:mm')} ${zoneCity(zone)}`, [dates]);
  return useMemo(() => ({ salon: at, mine: (iso: string) => at(iso, mine), zone: mine }), [at, mine]);
}
