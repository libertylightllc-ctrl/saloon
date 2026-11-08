/**
 * The Overview's salon card (owner, 2026-11-08): its groups — paid, free, pilot, free for good and ended — add up to
 * the salon total, and closed salons are named apart. A salon whose period is over says "Ended on <date>" in the lists.
 */
import { screen } from '@testing-library/react-native';

import type { AdminSalon } from '@/features/plan/api';
import { i18n } from '@/lib/i18n';
import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { accessLabel } from './AccessForm';
import type { Overview } from './api';
import { OverviewTab } from './OverviewTab';

// The live numbers on 8 Nov 2026: 8 open salons, 3 of them ended, and 2 closed.
const mockOverview: Overview = {
  salons: 8,
  salons_closed: 2,
  salons_plan_active: 0,
  salons_trial: 4,
  salons_pilot: 1,
  salons_comp: 0,
  salons_ended: 3,
  salons_test: 4,
  billing_enabled: false,
  pilot_places_left: 14,
  pilot_applications_new: 0,
  plan_requests_open: 2,
  branches: 10,
  accounts: 20,
  owners: 10,
  staff_logins: 5,
  no_salon: 2,
  signups_7d: 1,
  signups_30d: 6,
  signed_in_7d: 4,
  countries: [{ code: 'AE', salons: 10 }],
  sales_month: [],
  plan_income: [],
};
jest.mock('./api', () => ({
  useOverview: () => ({ data: mockOverview, isPending: false, isError: false, error: null, refetch: jest.fn() }),
}));
// The bottom sheet's animation library does not load in tests; none is opened here.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

it('the salon groups add up to the total, with "ended" among them and closed salons named apart', async () => {
  await renderInApp(<OverviewTab onOpenPilot={jest.fn()} />);
  expect(screen.getByTestId('console-salons-value')).toHaveTextContent('8');
  expect(screen.getByTestId('console-salons-sub')).toHaveTextContent(
    '0 paid · 4 free · 1 pilot · 0 free for good · 3 ended. Not counted: 2 closed',
  );
  const o = mockOverview;
  expect(o.salons_plan_active + o.salons_trial + o.salons_pilot + o.salons_comp + o.salons_ended).toBe(o.salons);
});

it('a salon whose period is over says "Ended on <date>" in place of "Free until" or "Paid until"', async () => {
  await renderInApp(<></>);
  const t = i18n.getFixedT('en');
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const salon = (s: Partial<AdminSalon>) =>
    ({ access_type: 'paid', free_until: null, paid_until: null, status: 'paid', ended_on: null, ...s }) as AdminSalon;
  expect(accessLabel(salon({ paid_until: '2026-11-05', status: 'ended', ended_on: '2026-11-05' }), t, day)).toBe('Ended on 5 Nov 2026');
  expect(accessLabel(salon({ access_type: 'trial', free_until: '2026-11-05', status: 'ended', ended_on: '2026-11-05' }), t, day)).toBe(
    'Ended on 5 Nov 2026',
  );
  expect(accessLabel(salon({ paid_until: '2026-12-05' }), t, day)).toBe('Paid until 5 Dec 2026');
  expect(accessLabel(salon({ access_type: 'trial', free_until: '2026-11-18', status: 'free' }), t, day)).toBe('Free until 18 Nov 2026');
  // No period ever recorded: as before.
  expect(accessLabel(salon({ access_type: null, status: 'ended' }), t, day)).toBe('No free time');
});
