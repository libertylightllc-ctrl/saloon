/**
 * Who is responsible for the app (full update, Phase 5): the operator once the owner sets one, named with the address to
 * write to — never a company claim; the terms: free to start, per branch, three billing lengths and the pilot.
 */
import { screen } from '@testing-library/react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { LegalScreen } from './LegalScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => false }),
  usePathname: () => '/terms',
}));
jest.mock('@/config/site', () => ({ site: { operatorName: 'Example Operator' } }));
// The bottom sheet's animation library does not load in tests; this page has no sheet.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

it('the privacy policy names who is responsible for the app and where to write', async () => {
  await renderInApp(<LegalScreen kind="privacy" />);
  expect(screen.getByTestId('legal-who')).toHaveTextContent(
    'Example Operator is responsible for Saloqo (“we”), the app and the website at www.saloqo.com. You can reach us at hello@saloqo.com.',
  );
  expect(screen.getByText(/Federal Decree-Law No. 45 of 2021/)).toBeTruthy();
});

it('the terms: free to start, priced per branch for 1, 6 or 12 months, the pilot; no 7-day trial', async () => {
  await renderInApp(<LegalScreen kind="terms" />);
  expect(screen.getByText(/priced per branch per month/)).toBeTruthy();
  expect(screen.getByText(/in More → Plan & billing/)).toBeTruthy();
  expect(screen.getByText('The pilot')).toBeTruthy();
  expect(screen.queryByText(/7 days/)).toBeNull();
});
