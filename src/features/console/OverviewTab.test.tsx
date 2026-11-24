/**
 * The Overview's salon card (owner, 2026-11-08): its groups — paid, free, pilot, free for good and ended — add up to
 * the salon total, and closed salons are named apart. A salon whose period is over says "Ended on <date>" in the lists.
 */
import { fireEvent, screen } from '@testing-library/react-native';

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
  accounts_active: 16,
  accounts_off: 2,
  accounts_deleted: 2,
  accounts_test: 11,
  owners: 10,
  staff_logins: 5,
  no_salon: 2,
  new_salons_7d: 0,
  new_salons_30d: 3,
  salons_signed_in_7d: 2,
  signed_in_7d: 4,
  countries: [{ code: 'AE', salons: 10 }],
  sales_month: [],
  plan_income: [{ currency: 'AED', total_minor: 9900 }, { currency: 'USD', total_minor: 4299 }],
  plan_income_month: [],
};
jest.mock('./api', () => ({
  useOverview: () => ({ data: mockOverview, isPending: false, isError: false, error: null, refetch: jest.fn() }),
  usePayments: () => ({ data: [], isPending: false, isError: false, error: null, refetch: jest.fn() }),
  useMarkPayment: () => ({ mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null }),
}));
// Part B's business numbers: two currencies converted to USD, one salon that stopped paying.
const mockFx = {
  reporting_currency: 'USD',
  day: '2026-11-25',
  fixed: ['AED', 'BHD', 'JOD', 'OMR', 'QAR', 'SAR', 'USD'],
  rates: { USD: 1, AED: 3.6725, QAR: 3.64 },
};
const mockRevenue = {
  month: '2026-11-01',
  paying: 3,
  paying_unpriced: 1,
  mrr: [
    { currency: 'AED', minor: 82_500 },
    { currency: 'USD', minor: 1_699 },
  ],
  paying_prev: 1,
  mrr_prev: [{ currency: 'AED', minor: 36_725 }],
  conversion: { ended: 4, paid: 1 },
  churn: [{ business_id: 'b-9', name: 'Palm Salon', code: 'palm22', stopped_on: '2026-11-12', status: 'ended', currency: 'QAR', minor: 4_900 }],
};
const ok = (data: unknown) => ({ data, isPending: false, isError: false, error: null, refetch: jest.fn() });
const mockActivity = {
  open: 8,
  active_7d: 2,
  active_30d: 5,
  at_risk_count: 3,
  at_risk: [
    { business_id: 'b-1', name: 'Cedar Cuts', code: 'cedarcuts', status: 'free', country_code: 'AE', timezone: 'Asia/Dubai', last_active: null },
    { business_id: 'b-2', name: 'Blue Comb', code: 'bluecomb', status: 'paid', country_code: 'QA', timezone: 'Asia/Qatar', last_active: '2026-10-28T21:30:00Z' },
  ],
};
jest.mock('./overviewApi', () => ({
  useFxRates: () => ok(mockFx),
  useRevenue: () => ok(mockRevenue),
  useSalonActivity: () => ok(mockActivity),
  useComingUp: () => ok({ ending: [], requests: [] }),
  useLogContact: () => ({ mutateAsync: jest.fn(), isPending: false, error: null }),
}));
// The bottom sheet's animation library does not load in tests; none is opened here.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

it('the salon groups add up to the total, with "ended" among them and closed salons named apart', async () => {
  await renderInApp(<OverviewTab onOpenPilot={jest.fn()} onOpenSalons={jest.fn()} onOpenSalon={jest.fn()} />);
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

it('while billing is off, ended salons say they still work, and the Overview warns before billing goes on (owner’s brief A7)', async () => {
  const onOpenSalons = jest.fn();
  await renderInApp(<OverviewTab onOpenPilot={jest.fn()} onOpenSalons={onOpenSalons} onOpenSalon={jest.fn()} />);
  expect(screen.getByTestId('console-ended-warning')).toHaveTextContent(/3 ended · they lose access when billing is switched on/);
  fireEvent.press(screen.getByTestId('console-ended-warning'));
  expect(onOpenSalons).toHaveBeenCalledWith('ended');
  const t = i18n.getFixedT('en');
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const ended = { access_type: 'trial', free_until: '2026-11-05', paid_until: null, status: 'ended', ended_on: '2026-11-05' } as AdminSalon;
  expect(accessLabel(ended, t, day, { billingOff: true })).toBe('Ended on 5 Nov 2026 (still working: billing is off)');
  expect(accessLabel(ended, t, day, { billingOff: false })).toBe('Ended on 5 Nov 2026');
});

it('a closed salon shows only the day it closed, not its free period (owner’s brief A6)', async () => {
  await renderInApp(<></>);
  const t = i18n.getFixedT('en');
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const closed = { access_type: 'trial', free_until: '2026-12-04', paid_until: null, status: 'closed', ended_on: null, closed_at: '2026-11-20T09:00:00Z' } as AdminSalon;
  expect(accessLabel(closed, t, day)).toBe('Closed on 20 Nov 2026');
});

it('one rule for the numbers, accounts with their split, new salons, and plan payments by period (owner’s brief A3–A4)', async () => {
  await renderInApp(<OverviewTab onOpenPilot={jest.fn()} onOpenSalons={jest.fn()} onOpenSalon={jest.fn()} />);
  expect(screen.getByTestId('console-rule')).toHaveTextContent('Test and closed salons are left out.');
  expect(screen.getByTestId('console-accounts-value')).toHaveTextContent('20');
  expect(screen.getByTestId('console-accounts-sub')).toHaveTextContent(/16 active · 2 switched off · 2 deleted/);
  expect(screen.getByTestId('console-new-salons-value')).toHaveTextContent('0');
  expect(screen.getByTestId('console-new-salons-sub')).toHaveTextContent('3 in the last 30 days');
  // Signing in is part of the Active salons card (owner's brief B3).
  expect(screen.getByTestId('console-active-sub')).toHaveTextContent(/4 accounts signed in this week/);
  expect(screen.getByTestId('console-plan-income-month')).toHaveTextContent(/This month.*Nothing yet\./);
  expect(screen.getByTestId('console-plan-income-all')).toHaveTextContent(/All time.*AED 99\.00 · USD 42\.99/);
});

it('money: monthly income in the reporting currency, the year at that rate, last month, conversion and churn', async () => {
  await renderInApp(<OverviewTab onOpenPilot={jest.fn()} onOpenSalons={jest.fn()} onOpenSalon={jest.fn()} />);
  // AED 825.00 a month is about USD 224.64; with USD 16.99, about USD 241.63.
  expect(screen.getByTestId('console-mrr-value')).toHaveTextContent('≈ USD 241.63');
  expect(screen.getByTestId('console-mrr-sub')).toHaveTextContent(
    '≈ USD 2,899.56 a year (ARR) 3 paying salons End of last month: ≈ USD 100.00 1 switched on without a payment (adds nothing)',
  );
  expect(screen.getByTestId('console-mrr')).toHaveTextContent(/▲ 141\.63%/);
  expect(screen.getByTestId('console-conversion-value')).toHaveTextContent('25%');
  expect(screen.getByTestId('console-conversion-sub')).toHaveTextContent(
    '1 of 4 salons whose free period or pilot ended in the last 90 days paid Billing is off, so nobody has had to pay yet.',
  );
  expect(screen.getByTestId('console-churn-value')).toHaveTextContent('1');
  expect(screen.getByTestId('console-churn-sub')).toHaveTextContent('≈ USD 13.46 a month lost');
  expect(screen.getByTestId('console-fx-note')).toHaveTextContent('≈ converted at the exchange rates of 25 Nov 2026. Rates by Exchange Rate API');
});

it('salons by status: each group with its number opens Salons on that group (owner’s brief B2)', async () => {
  const onOpenSalons = jest.fn();
  await renderInApp(<OverviewTab onOpenPilot={jest.fn()} onOpenSalons={onOpenSalons} onOpenSalon={jest.fn()} />);
  const groups = ['paid', 'free', 'pilot', 'comp', 'ended', 'closed'].map((g) => screen.getByTestId(`console-status-${g}-value`).props.children);
  expect(groups).toEqual(['0', '4', '1', '0', '3', '2']);
  await fireEvent.press(screen.getByTestId('console-status-comp'));
  expect(onOpenSalons).toHaveBeenCalledWith('comp');
});

it('active salons in the last 7 and 30 days, and those at risk (owner’s brief B3, B7)', async () => {
  await renderInApp(<OverviewTab onOpenPilot={jest.fn()} onOpenSalons={jest.fn()} onOpenSalon={jest.fn()} />);
  expect(screen.getByTestId('console-active-value')).toHaveTextContent('2');
  expect(screen.getByTestId('console-active-sub')).toHaveTextContent('of 8 open salons · 5 in the last 30 days 4 accounts signed in this week');
  expect(screen.getByTestId('console-at-risk-value')).toHaveTextContent('3');
});
