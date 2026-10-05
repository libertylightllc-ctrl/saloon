/**
 * 12- or 24-hour times, as each person's own phone or computer is set (owner, 2026-10-05: "where ever they login as per
 * location"). Times stay in the branch's time zone — only how they are written follows the device. Stored times
 * ("21:30" in rosters, slots and typed inputs) keep the 24-hour form; only what is shown changes.
 */
import { getCalendars } from 'expo-localization';
import { Platform } from 'react-native';

function detect(): boolean {
  try {
    if (Platform.OS !== 'web') {
      const uses24 = getCalendars()[0]?.uses24hourClock;
      if (typeof uses24 === 'boolean') return !uses24;
    }
    // The browser's own language and region (en-US → 9:30 PM, en-GB → 21:30).
    const cycle = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
    return cycle === 'h12' || cycle === 'h11';
  } catch {
    return false;
  }
}

let twelveHour = detect();

export function uses12HourClock(): boolean {
  return twelveHour;
}

/** For tests. */
export function setTwelveHourClock(value: boolean): void {
  twelveHour = value;
}

/** A date-fns pattern in the person's clock: "d MMM · HH:mm" → "d MMM · h:mm a" on a 12-hour device. */
export function clockPattern(pattern: string): string {
  return twelveHour ? pattern.replace(/HH:mm/g, 'h:mm a') : pattern;
}

/** A stored time of day ("21:30", "09:00:00") in the person's clock: "9:30 PM" on a 12-hour device. */
export function clockText(time: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return time;
  const hours = Number(m[1]);
  if (!twelveHour) return `${m[1]!.padStart(2, '0')}:${m[2]}`;
  const h = hours % 12 === 0 ? 12 : hours % 12;
  return `${h}:${m[2]} ${hours < 12 || hours === 24 ? 'AM' : 'PM'}`;
}
