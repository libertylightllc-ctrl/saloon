/** While a plan request waits, the Plan page says so in place of a way to ask again (final brief E3). */
import { screen } from '@testing-library/react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { RequestWaiting } from './RequestWaiting';

// The bottom sheet's animation library does not load in tests; this card has none.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

it('says the request was sent, what was asked and when', async () => {
  await renderInApp(<RequestWaiting plan={{ requested_at: '2026-10-20T17:33:44Z', requested_months: 1 }} timeZone="Asia/Dubai" />);
  const card = screen.getByTestId('plan-requested');
  expect(card).toHaveTextContent(/Request sent, we’ll be in touch/);
  expect(card).toHaveTextContent(/You asked for 1 month on 20 Oct 2026/);
});

it('shows nothing when no request waits', async () => {
  await renderInApp(<RequestWaiting plan={{ requested_at: null, requested_months: null }} timeZone="Asia/Dubai" />);
  expect(screen.queryByTestId('plan-requested')).toBeNull();
});
