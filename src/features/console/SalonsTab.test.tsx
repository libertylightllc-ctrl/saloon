/**
 * The console's Salons list draws 50 salons at a time (owner's fix list #12): hundreds of rows at once made the tab
 * slow. "Show more" adds the next 50, and search looks through every salon, not only the ones drawn. Salons that look
 * like the same owner are marked, naming the others (final brief C4). Branches are counted in words (E4). Test salons
 * are labelled "Test" (E1). A status filter shows one group at a time, with the search (owner, 2026-11-08).
 */
import { fireEvent, screen } from '@testing-library/react-native';

import type { AdminSalon } from '@/features/plan/api';
import { i18n } from '@/lib/i18n';
import arabic from '@/locales/ar.json';
import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { SalonsTab } from './SalonsTab';

const mockSalons: AdminSalon[] = Array.from({ length: 60 }, (_, i) => ({
  business_id: `b-${i}`,
  name: `Salon ${i}`,
  code: `salon${i}`,
  created_at: '2026-10-01T08:00:00Z',
  owner_name: i === 20 ? null : `Owner ${i}`,
  owner_email: null,
  branches: i === 2 ? 2 : 1,
  paid_until: null,
  active: true,
  requested_at: null,
  requested_months: null,
  request_note: null,
  country_code: 'AE',
  timezone: 'Asia/Dubai',
  people: 1,
  monthly_minor: 5000,
  plan_currency: 'AED',
  trial: true,
  access_type: 'trial',
  free_until: '2026-12-01',
  pilot_code: null,
  admin_note: null,
  staff: 0,
  last_active: null,
  // One of each group; the rest in a free period. Salon 5 is a test salon whose period is over.
  status: ({ 5: 'ended', 10: 'ended', 11: 'paid', 12: 'closed', 13: 'comp', 14: 'pilot' } as const)[i] ?? 'free',
  ended_on: i === 5 ? '2026-10-30' : i === 10 ? '2026-11-05' : null,
  // Salon 20's owner deleted their account (owner's brief A1).
  owner_deleted_at: i === 20 ? '2026-11-03T10:00:00Z' : null,
  closed_at: i === 12 ? '2026-11-20T09:00:00Z' : null,
  close_note: i === 12 ? 'Opened twice by mistake' : null,
  closed_by_name: i === 12 ? 'Saloqo team' : null,
}));

jest.mock('@/features/plan/api', () => ({
  useAdminSalons: () => ({ data: mockSalons, isPending: false, isError: false, error: null, refetch: jest.fn() }),
  useAdminPlanAction: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));
let mockStatsFailed = false;
const mockRefetchStats = jest.fn();
jest.mock('./api', () => ({
  useSalonStats: () =>
    mockStatsFailed
      ? { data: undefined, isError: true, error: { message: 'canceling statement due to statement timeout' }, refetch: mockRefetchStats }
      : { data: new Map(), isError: false, error: null, refetch: mockRefetchStats },
  useCloseSalon: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  useSalonDuplicates: () => ({
    data: new Map([
      ['b-3', { name: [{ name: 'Salon 7', code: 'salon7' }], phone: [{ name: 'Salon 7', code: 'salon7' }, { name: 'Salon 9', code: 'salon9' }] }],
      // Two other salons with the same name (owner's brief A2).
      ['b-6', { name: [{ name: 'Salon 8', code: 'salon8' }, { name: 'Salon 8', code: 'salon8b' }] }],
    ]),
  }),
  useTestSalons: () => ({ data: new Set(['b-5']) }),
  useBillingSettings: () => ({ data: { billing_enabled: false } }),
  useSetTestSalon: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));
jest.mock('./AccessForm', () => ({ AccessForm: () => null, accessLabel: () => 'Free until 1 Dec 2026' }));
// The bottom sheet's animation library does not load in tests; no sheet is opened here.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

const rows = () => screen.queryAllByTestId(/^admin-salon-salon\d+$/);

// Drawing 50+ rows takes a few seconds in the test renderer when every test file runs at once.
jest.setTimeout(30_000);

it('draws 50 salons, then the rest on "Show more"', async () => {
  await renderInApp(<SalonsTab onHistory={jest.fn()} />);
  expect(rows()).toHaveLength(50);
  expect(screen.getByTestId('console-salons-showing')).toHaveTextContent('Showing 50 of 60');
  await fireEvent.press(screen.getByTestId('console-salons-more'));
  expect(rows()).toHaveLength(60);
  expect(screen.queryByTestId('console-salons-more')).toBeNull();
});

it('search finds a salon past the first 50, and a new search starts from the top again', async () => {
  await renderInApp(<SalonsTab onHistory={jest.fn()} />);
  await fireEvent.changeText(screen.getByTestId('console-salon-search'), 'salon59');
  expect(rows()).toHaveLength(1);
  expect(screen.getByTestId('admin-salon-salon59')).toBeTruthy();
  expect(screen.queryByTestId('console-salons-more')).toBeNull();
  await fireEvent.changeText(screen.getByTestId('console-salon-search'), 'Owner 1');
  // Owner 1 and 10–19: 11, all drawn.
  expect(rows()).toHaveLength(11);
  await fireEvent.changeText(screen.getByTestId('console-salon-search'), '');
  expect(rows()).toHaveLength(50);
});

it('when the activity lines fail to load, it says so and offers to try again; the salons still show', async () => {
  mockStatsFailed = true;
  await renderInApp(<SalonsTab onHistory={jest.fn()} />);
  expect(screen.getByTestId('console-stats-error')).toBeTruthy();
  expect(rows()).toHaveLength(50);
  await fireEvent.press(screen.getByTestId('console-stats-retry'));
  expect(mockRefetchStats).toHaveBeenCalled();
  mockStatsFailed = false;
});

it('marks a likely duplicate and names the other salons', async () => {
  await renderInApp(<SalonsTab onHistory={jest.fn()} />);
  const row = screen.getByTestId('admin-salon-salon3');
  expect(row).toHaveTextContent(/Possible duplicate/);
  expect(row).toHaveTextContent(/Same owner name as Salon 7/);
  expect(row).toHaveTextContent(/Same number as Salon 7, Salon 9/);
  expect(screen.getByTestId('admin-salon-salon4')).not.toHaveTextContent(/Possible duplicate/);
  // Two others with one name: each with its code.
  expect(screen.getByTestId('admin-salon-salon6')).toHaveTextContent(/Same owner name as Salon 8 \(salon8\), Salon 8 \(salon8b\)/);
});

it('a closed salon says why and who closed it (owner’s brief A6)', async () => {
  await renderInApp(<SalonsTab onHistory={jest.fn()} />);
  expect(screen.getByTestId('admin-salon-salon12')).toHaveTextContent(/Opened twice by mistake · by Saloqo team/);
});

it('a deleted owner shows as the date their account was deleted, never the scrambled email (owner’s brief A1)', async () => {
  await renderInApp(<SalonsTab onHistory={jest.fn()} />);
  expect(screen.getByTestId('admin-salon-salon20')).toHaveTextContent(/Owner account deleted on 3 Nov 2026/);
  expect(screen.getByTestId('admin-salon-salon21')).toHaveTextContent(/Owner 21/);
});

it('counts branches in words: "1 branch", "2 branches", and Arabic’s own forms (final brief E4)', async () => {
  await renderInApp(<SalonsTab onHistory={jest.fn()} />);
  expect(screen.getByTestId('admin-salon-salon0')).toHaveTextContent(/Code salon0 · 1 branch · joined 1 Oct 2026/);
  expect(screen.getByTestId('admin-salon-salon2')).toHaveTextContent(/Code salon2 · 2 branches · joined 1 Oct 2026/);
  if (!i18n.hasResourceBundle('ar', 'translation')) i18n.addResourceBundle('ar', 'translation', arabic);
  const ar = i18n.getFixedT('ar');
  const branches = (count: number) => ar('console.salons.branches', { count });
  expect([1, 2, 3, 11, 100].map(branches)).toEqual([
    expect.stringMatching(/^فرع واحد$/),
    expect.stringMatching(/^فرعان$/),
    expect.stringMatching(/3\S* فروع$/),
    expect.stringMatching(/11\S* فرعًا$/),
    expect.stringMatching(/100\S* فرع$/),
  ]);
});

it('labels a test salon "Test", and only that one (final brief E1)', async () => {
  await renderInApp(<SalonsTab onHistory={jest.fn()} />);
  expect(screen.getByTestId('admin-salon-salon5')).toHaveTextContent(/Test/);
  expect(screen.getByTestId('admin-salon-salon4')).not.toHaveTextContent(/Test/);
});

it('the status filter counts each group and shows only its salons; a test salon is only under All and Test', async () => {
  await renderInApp(<SalonsTab onHistory={jest.fn()} />);
  const pill = (f: string) => screen.getByTestId(`console-salon-filter-${f}`);
  expect(pill('all')).toHaveTextContent('All 60');
  expect(pill('paid')).toHaveTextContent('Paid 1');
  // Free includes free for good (salon 13).
  expect(pill('free')).toHaveTextContent('Free 55');
  expect(pill('pilot')).toHaveTextContent('Pilot 1');
  expect(pill('ended')).toHaveTextContent('Ended 1');
  expect(pill('closed')).toHaveTextContent('Closed 1');
  expect(pill('test')).toHaveTextContent('Test 1');

  await fireEvent.press(pill('ended'));
  expect(rows().map((r) => r.props.testID)).toEqual(['admin-salon-salon10']);
  await fireEvent.press(pill('test'));
  expect(rows().map((r) => r.props.testID)).toEqual(['admin-salon-salon5']);
  await fireEvent.press(pill('free'));
  expect(rows()).toHaveLength(50);
  expect(screen.getByTestId('console-salons-showing')).toHaveTextContent('Showing 50 of 55');

  // With a search: the counts follow it, and a group with none of its salons says so.
  await fireEvent.changeText(screen.getByTestId('console-salon-search'), 'salon1');
  expect(pill('all')).toHaveTextContent('All 11');
  expect(pill('ended')).toHaveTextContent('Ended 1');
  expect(pill('test')).toHaveTextContent('Test 0');
  await fireEvent.press(pill('test'));
  expect(rows()).toHaveLength(0);
  expect(screen.getByText('No salons here.')).toBeTruthy();
  await fireEvent.press(pill('all'));
  expect(rows()).toHaveLength(11);
  expect(screen.queryByText('No salons here.')).toBeNull();
});
