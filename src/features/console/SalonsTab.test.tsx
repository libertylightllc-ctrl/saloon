/**
 * The console's Salons list draws 50 salons at a time (owner's fix list #12): hundreds of rows at once made the tab
 * slow. "Show more" adds the next 50, and search looks through every salon, not only the ones drawn.
 */
import { fireEvent, screen } from '@testing-library/react-native';

import type { AdminSalon } from '@/features/plan/api';
import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { SalonsTab } from './SalonsTab';

const mockSalons: AdminSalon[] = Array.from({ length: 60 }, (_, i) => ({
  business_id: `b-${i}`,
  name: `Salon ${i}`,
  code: `salon${i}`,
  created_at: '2026-10-01T08:00:00Z',
  owner_name: `Owner ${i}`,
  owner_email: null,
  branches: 1,
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
