/**
 * Home's compliance pill (owner's app check A4, 9 Nov 2026): a licence expiring in 2 days without its scan and a lease
 * never entered read "Expires in 2 days", not "Expired"; "Expired" only once a date has passed.
 */
import { i18n, initI18n } from '@/lib/i18n';

import type { Dashboard } from './api';
import { compliancePill } from './NeedsAttention';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
// The shared UI's bottom sheet needs native animation modules the test renderer lacks.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

type C = NonNullable<Dashboard['compliance']>;
const none: C = { readiness: 50, attention: 0, expired: 0, missing: 0, missing_date: 0, evidence_missing: 0, due_soon: 0, soonest_days: null };

beforeAll(() => initI18n('en'));

it('the case from the check: expires in 2 days and one missing', () => {
  expect(compliancePill({ ...none, attention: 2, evidence_missing: 1, missing: 1, soonest_days: 2 }, i18n.t)).toEqual({
    status: 'due_soon',
    label: 'Expires in 2 days',
  });
});

it('one day, today, and a passed date', () => {
  expect(compliancePill({ ...none, attention: 1, due_soon: 1, soonest_days: 1 }, i18n.t).label).toBe('Expires in 1 day');
  expect(compliancePill({ ...none, attention: 1, due_soon: 1, soonest_days: 0 }, i18n.t).label).toBe('Expires today');
  expect(compliancePill({ ...none, attention: 2, expired: 1, missing: 1, soonest_days: 3 }, i18n.t)).toEqual({ status: 'expired' });
});

it('nothing expiring: the worst real status', () => {
  expect(compliancePill({ ...none, attention: 1, missing: 1 }, i18n.t).label).toBe('Missing');
  expect(compliancePill({ ...none, attention: 1, evidence_missing: 1 }, i18n.t).label).toBe('Scan missing');
  expect(compliancePill({ ...none, attention: 1, missing_date: 1 }, i18n.t).label).toBe('No expiry date');
});
