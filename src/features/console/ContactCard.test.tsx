/**
 * Console → Settings → Contact (owner's fix list A4): the WhatsApp number and message as saved; a number without the
 * country code cannot be saved; the number goes to the database as typed and comes back as it keeps it.
 */
import { fireEvent, screen } from '@testing-library/react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { ContactCard, numberOk } from './ContactCard';

const mockMutate = jest.fn();
jest.mock('./api', () => ({
  useSetContact: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));
jest.mock('@/features/landing/contact', () => ({
  useContactSetting: () => ({
    data: { whatsapp_number: '', whatsapp_message: "Hi Saloqo, I'd like to know more about the pilot for my salon." },
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

// The bottom sheet's animation library does not load in tests; this card has none.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

it('starts from the saved values and saves the number as typed', async () => {
  await renderInApp(<ContactCard />);
  expect(screen.getByTestId('console-whatsapp-message').props.value).toBe(
    "Hi Saloqo, I'd like to know more about the pilot for my salon.",
  );
  await fireEvent.changeText(screen.getByTestId('console-whatsapp-number'), '050 123 4567');
  expect(screen.getByText('Start with + and the country code, for example +971 50 123 4567.')).toBeTruthy();
  expect(screen.getByTestId('console-contact-save')).toBeDisabled();

  await fireEvent.changeText(screen.getByTestId('console-whatsapp-number'), '+971 50 123 4567');
  expect(screen.queryByText('Start with + and the country code, for example +971 50 123 4567.')).toBeNull();
  await fireEvent.press(screen.getByTestId('console-contact-save'));
  expect(mockMutate).toHaveBeenCalledWith(
    { number: '+971 50 123 4567', message: "Hi Saloqo, I'd like to know more about the pilot for my salon." },
    expect.anything(),
  );
});

it('takes the number as people write it: spaces, brackets, dashes, 00 for +; empty hides WhatsApp', () => {
  expect(numberOk('+971 (50) 123-4567')).toBe(true);
  expect(numberOk('00971 50 123 4567')).toBe(true);
  expect(numberOk('')).toBe(true);
  expect(numberOk('050 123 4567')).toBe(false);
  expect(numberOk('+0 50 123 4567')).toBe(false);
  expect(numberOk('+971 50')).toBe(false);
});
