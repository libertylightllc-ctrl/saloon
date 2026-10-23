/** "Saloqo is provided by <legal name>, <address>" on both legal pages, once the owner has set them (brief 5.2). */
import { screen } from '@testing-library/react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { LegalScreen } from './LegalScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => false }),
  usePathname: () => '/terms',
}));
jest.mock('@/config/site', () => ({ site: { legalName: 'Saloqo FZ-LLC', legalAddress: 'Dubai Silicon Oasis, Dubai, UAE' } }));
// The bottom sheet's animation library does not load in tests; this page has no sheet.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

it.each(['terms', 'privacy'] as const)('the %s name who provides the app, with the address', async (kind) => {
  await renderInApp(<LegalScreen kind={kind} />);
  expect(screen.getByTestId('legal-provider')).toHaveTextContent('Saloqo is provided by Saloqo FZ-LLC, Dubai Silicon Oasis, Dubai, UAE.');
});
