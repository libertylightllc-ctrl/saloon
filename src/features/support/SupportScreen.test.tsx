/**
 * Help & support, Part E4 of the owner's console brief: "Chat with us on WhatsApp" when the team has a WhatsApp number,
 * its message naming the salon and its code; hidden without a number.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { SupportScreen } from './SupportScreen';

let mockHasWhatsApp = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => false }),
  usePathname: () => '/support',
}));
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));
jest.mock('@/features/auth/session', () => ({
  useWorkspace: () => ({ business: { id: 'b-1', name: 'Palm Salon', code: 'palm22' }, role: 'owner' }),
}));
jest.mock('@/features/landing/contact', () => ({
  useContact: () => ({
    hasWhatsApp: mockHasWhatsApp,
    whatsappUrl: (text: string) => `https://wa.me/971501234567?text=${encodeURIComponent(text)}`,
  }),
}));
jest.mock('./api', () => ({
  useSupportMine: () => ({
    data: { id: null, status: 'open', messages: [] },
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
  useSupportSend: () => ({ mutate: jest.fn(), isPending: false, error: null }),
}));
jest.mock('./faqAudience', () => ({ useMemberFaq: () => ({ asker: 'owner', plans: false, billing: false, price: null }) }));
jest.mock('./CommonQuestions', () => ({ CommonQuestions: () => null }));

warmUpRendering();

beforeEach(() => {
  mockHasWhatsApp = true;
});

it('opens WhatsApp with a message that names the salon and its code', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await renderInApp(<SupportScreen />);
  expect(screen.getByTestId('support-whatsapp')).toHaveTextContent('Chat with us on WhatsApp');
  await act(async () => fireEvent.press(screen.getByTestId('support-whatsapp')));
  expect(open).toHaveBeenCalledWith(
    `https://wa.me/971501234567?text=${encodeURIComponent('Hi Saloqo, I need help with the app. Salon: Palm Salon (palm22)')}`,
  );
});

it('is not there when the team has no WhatsApp number', async () => {
  mockHasWhatsApp = false;
  await renderInApp(<SupportScreen />);
  expect(screen.queryByTestId('support-whatsapp')).toBeNull();
});
