/**
 * Console → Accounts draws 50 accounts at a time: thousands at once froze the page for half a minute. "Show more"
 * adds the next 50, and search looks through every account. A deleted account says when, never a scrambled email,
 * and the heading counts accounts as the Overview does (owner's brief A1, A3).
 */
import { fireEvent, screen } from '@testing-library/react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import type { Account } from './api';
import { AccountsTab } from './AccountsTab';

const mockAccounts: Account[] = Array.from({ length: 60 }, (_, i) => ({
  user_id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
  email: i === 7 ? null : `owner${i}@example.com`,
  username: null,
  display_name: i === 7 ? null : `Owner ${i}`,
  role: 'owner',
  business_id: `b-${i}`,
  salon: `Salon ${i}`,
  active: i !== 7,
  created_at: '2026-10-01T08:00:00Z',
  last_sign_in_at: null,
  confirmed: true,
  provider: 'email',
  platform_owner: false,
  phone: null,
  whatsapp_ok: false,
  whatsapp_ok_at: null,
  deleted_at: i === 7 ? '2026-11-03T10:00:00Z' : null,
}));

jest.mock('./api', () => ({
  useAccounts: () => ({ data: mockAccounts, isPending: false, isError: false, error: null, refetch: jest.fn() }),
  useOverview: () => ({ data: { accounts: 59, accounts_active: 57, accounts_off: 1, accounts_deleted: 1, accounts_test: 1 } }),
  useTestSalons: () => ({ data: new Set(['b-3']) }),
  useSetPlatformOwner: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));
// The bottom sheet's animation library does not load in tests; no sheet is opened here.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

const rows = () => screen.queryAllByTestId(/^console-account-(owner\d+@example\.com|deleted-.+)$/);

// Drawing 50+ rows takes a few seconds in the test renderer when every test file runs at once.
jest.setTimeout(30_000);

it('draws 50 accounts, then the rest on "Show more"', async () => {
  await renderInApp(<AccountsTab />);
  expect(rows()).toHaveLength(50);
  expect(screen.getByTestId('console-accounts-showing')).toHaveTextContent('Showing 50 of 60');
  await fireEvent.press(screen.getByTestId('console-accounts-more'));
  expect(rows()).toHaveLength(60);
  expect(screen.queryByTestId('console-accounts-more')).toBeNull();
});

it('search finds an account past the first 50, and a new search starts from the top again', async () => {
  await renderInApp(<AccountsTab />);
  await fireEvent.changeText(screen.getByTestId('console-account-search'), 'owner59@');
  expect(rows()).toHaveLength(1);
  expect(screen.getByTestId('console-account-owner59@example.com')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('console-account-search'), 'example.com');
  expect(rows()).toHaveLength(50);
});

it('a deleted account says when, and the heading counts as the Overview', async () => {
  await renderInApp(<AccountsTab />);
  expect(screen.getByTestId('console-account-deleted-00000000')).toHaveTextContent(/Account deleted on 3 Nov 2026/);
  expect(screen.getByTestId('console-accounts-split')).toHaveTextContent(
    '57 active · 1 switched off · 1 deleted · 1 test salon account is listed but not counted',
  );
  expect(screen.getByText('59 accounts')).toBeTruthy();
});
