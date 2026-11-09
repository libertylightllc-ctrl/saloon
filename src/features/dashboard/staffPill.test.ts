/**
 * Home → Staff today (owner's app check A5/D2/D3, 9 Nov 2026): a day off is "Day off", not "Available"; a shift nobody
 * clocked in to is "Late · not in", then "Absent"; and late minutes read "11 h 37 min", not "697 min".
 */
import { formatDuration } from '@/lib/duration';
import { i18n, initI18n } from '@/lib/i18n';

import { staffPill } from './HomeSections';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
// The shared UI's bottom sheet needs native animation modules the test renderer lacks.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

beforeAll(() => initI18n('en'));

it.each([
  [{ busy: false, status: 'off' as const }, 'Day off', 'cancelled'],
  [{ busy: false, status: 'available' as const }, 'Available', 'completed'],
  [{ busy: false, status: 'on_shift' as const }, 'On shift', 'completed'],
  [{ busy: true, status: 'on_shift' as const }, 'With client', 'in_progress'],
  [{ busy: false, status: 'not_in' as const }, 'Not in yet', 'waiting'],
  [{ busy: false, status: 'late_not_in' as const }, 'Late · not in', 'overdue'],
  [{ busy: false, status: 'absent' as const }, 'Absent', 'expired'],
  [{ busy: false, status: 'on_break' as const }, 'On break', 'pending_approval'],
  [{ busy: false, status: 'done' as const }, 'Done', 'cancelled'],
])('%o reads "%s"', (person, label, status) => {
  expect(staffPill(person, i18n.t)).toEqual({ status, label });
});

it('an older server without a status still reads "Available"', () => {
  expect(staffPill({ busy: false }, i18n.t).label).toBe('Available');
});

it('minutes read as hours and minutes', () => {
  expect(formatDuration(i18n.t, 697)).toBe('11 h 37 min');
  expect(formatDuration(i18n.t, 40)).toBe('40 min');
  expect(formatDuration(i18n.t, 120)).toBe('2 h');
  expect(i18n.t('attendance.lateBy', { time: formatDuration(i18n.t, 697) })).toBe('Late 11 h 37 min');
});

it('hours take their plural form', async () => {
  // Right-to-left text isolates each number (U+2068 … U+2069); the words are checked here.
  const say = async (lang: 'hi' | 'ur', minutes: number) => {
    await initI18n(lang);
    return formatDuration(i18n.getFixedT(lang), minutes).replace(/[\u2068\u2069]/g, '');
  };
  expect(await say('hi', 61)).toBe('1 घंटा 1 मिनट');
  expect(await say('hi', 697)).toBe('11 घंटे 37 मिनट');
  expect(await say('ur', 60)).toBe('1 گھنٹہ');
  expect(await say('ur', 180)).toBe('3 گھنٹے');
  await initI18n('en');
});
