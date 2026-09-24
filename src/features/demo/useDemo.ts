import { formatInTimeZone } from 'date-fns-tz';

import { DEFAULT_TIMEZONE } from '@/lib/dates';
import { useThemeMode } from '@/theme';

import { demoBranches } from './data';

export function useDemoBranch() {
  return demoBranches[useThemeMode().mode];
}

/** morning / afternoon / evening in branch time, for the Home greeting. */
export function partOfDay(at: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(formatInTimeZone(at, DEFAULT_TIMEZONE, 'H'));
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}
