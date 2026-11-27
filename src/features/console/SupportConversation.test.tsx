/**
 * A support conversation in the console (owner's brief, Part E): its status with a reason asked for while nobody has
 * answered (E1), saved replies filled in with who wrote, Reply on WhatsApp only with their OK and kept before WhatsApp
 * opens, and internal notes (E3).
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { AdminSupportThread, SupportThreadRow } from '@/features/support/adminApi';
import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { SupportConversation } from './SupportConversation';

const row: SupportThreadRow = {
  id: 'th-1',
  status: 'open',
  created_at: '2026-11-27T08:00:00Z',
  last_message_at: '2026-11-27T08:00:00Z',
  last_from: 'user',
  unread: 1,
  who: 'Layla',
  email: 'layla@palm.test',
  salon: 'Palm Salon',
  salon_code: 'palm22',
  role: 'owner',
  context: {},
  preview: 'My receipts print blank.',
  handover: true,
  stage: 'waiting_team',
  stage_at: '2026-11-27T08:05:00Z',
  first_asked_at: '2026-11-27T08:00:00Z',
  first_reply_at: null,
};
let mockThread: AdminSupportThread;
const mockWhatsApp = jest.fn();
const mockSetStage = jest.fn();
const mockNote = jest.fn();
const query = (data: unknown) => ({ data, isPending: false, isError: false, error: null, refetch: jest.fn() });
const mutation = (fn: jest.Mock) => ({
  mutate: (v: unknown, o?: { onSuccess?: () => void }) => {
    fn(v);
    o?.onSuccess?.();
  },
  mutateAsync: async (v: unknown) => fn(v),
  isPending: false,
  error: null,
  variables: undefined,
});
// The bottom sheet's animation library does not load in tests; this view has no sheet of its own.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));
jest.mock('@/features/support/adminApi', () => ({
  useSupportThreadAdmin: () => query(mockThread),
  useSupportReply: () => mutation(jest.fn()),
  useSupportWhatsApp: () => mutation(mockWhatsApp),
  useSupportSetStage: () => mutation(mockSetStage),
  useSupportNote: () => mutation(mockNote),
  useSavedReplies: () =>
    query([{ id: 'r-1', title: 'Receipts', body: 'Hi {name}, thanks for writing from {salon}.', updated_at: '' }]),
  useSaveReply: () => mutation(jest.fn()),
  useRemoveSavedReply: () => mutation(jest.fn()),
}));

warmUpRendering();

beforeEach(() => {
  mockThread = {
    id: 'th-1',
    status: 'open',
    stage: 'waiting_team',
    whatsapp: '+971501234567',
    messages: [{ id: 'm-1', author: 'user', body: 'My receipts print blank.', created_at: '2026-11-27T08:00:00Z' }],
    notes: [{ id: 'n-1', author: 'Sara', body: 'Star TSP100 printer', created_at: '2026-11-27T08:10:00Z' }],
  } as AdminSupportThread;
  mockWhatsApp.mockReset().mockResolvedValue('+971501234567');
  mockSetStage.mockReset();
  mockNote.mockReset();
});

it('shows the status and how long it has waited, and asks for a reason to mark it solved', async () => {
  await renderInApp(<SupportConversation row={row} onDone={jest.fn()} />);
  expect(screen.getByTestId('console-support-stage')).toHaveTextContent(/Waiting for you.*No reply yet.*Waiting/);
  await fireEvent.press(screen.getByTestId('console-support-to-solved'));
  expect(mockSetStage).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByTestId('console-support-reason'), 'Fixed by phone');
  await fireEvent.press(screen.getByTestId('console-support-reason-confirm'));
  expect(mockSetStage).toHaveBeenCalledWith({ thread: 'th-1', stage: 'solved', reason: 'Fixed by phone' });
});

it('a saved reply goes into the message box with the name and salon filled in', async () => {
  await renderInApp(<SupportConversation row={row} onDone={jest.fn()} />);
  await fireEvent.press(screen.getByTestId('console-saved-Receipts'));
  expect(screen.getByTestId('console-support-input').props.value).toBe('Hi Layla, thanks for writing from Palm Salon.');
});

it('replies on WhatsApp: the answer is kept first, then WhatsApp opens with it', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await renderInApp(<SupportConversation row={row} onDone={jest.fn()} />);
  await fireEvent.changeText(screen.getByTestId('console-support-input'), 'Please send a photo of the receipt');
  await act(async () => fireEvent.press(screen.getByTestId('console-support-whatsapp')));
  expect(mockWhatsApp).toHaveBeenCalledWith({ thread: 'th-1', body: 'Please send a photo of the receipt' });
  expect(open).toHaveBeenCalledWith(`https://wa.me/971501234567?text=${encodeURIComponent('Please send a photo of the receipt')}`);
  expect(screen.getByTestId('console-support-input').props.value).toBe('');
});

it('no WhatsApp OK, no WhatsApp button; the internal notes show who wrote them', async () => {
  mockThread = { ...mockThread, whatsapp: null };
  await renderInApp(<SupportConversation row={row} onDone={jest.fn()} />);
  expect(screen.queryByTestId('console-support-whatsapp')).toBeNull();
  expect(screen.getByTestId('console-support-notes')).toHaveTextContent(/Only platform owners see these.*Sara.*Star TSP100 printer/);
  await fireEvent.changeText(screen.getByTestId('console-support-note-input'), 'Asked for a photo');
  await fireEvent.press(screen.getByTestId('console-support-note-add'));
  expect(mockNote).toHaveBeenCalledWith({ thread: 'th-1', body: 'Asked for a photo' });
});
