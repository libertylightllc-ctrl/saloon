/**
 * B6 Coming up (owner's brief, Part B): free periods and pilots ending in the next 7 days with Extend and Message
 * owner, and plan requests waiting with their age. The message is written in the owner's language (Arabic here, in
 * an English console), WhatsApp only when the owner agreed, and it is logged before anything opens.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { ComingUp } from './ComingUp';
import type { ComingUp as Data, EndingSalon } from './overviewApi';

const DAY = 24 * 60 * 60 * 1000;
const ending = (s: Partial<EndingSalon>): EndingSalon => ({
  business_id: 'b-1',
  name: 'Palm Salon',
  code: 'palm22',
  timezone: 'Asia/Dubai',
  status: 'free',
  ends_on: '2026-11-28',
  days_left: 3,
  owner_name: 'Omar',
  email: 'owner@palm.test',
  whatsapp: '+971 50 123 4567',
  language: 'ar',
  contacted_at: null,
  ...s,
});
const mockData: Data = {
  ending: [
    ending({}),
    ending({ business_id: 'b-2', name: 'Cedar Cuts', code: 'cedarcuts', status: 'pilot', days_left: 0, ends_on: '2026-11-25', whatsapp: null, language: 'en', owner_name: null }),
  ],
  requests: [
    {
      business_id: 'b-3',
      name: 'Blue Comb',
      code: 'bluecomb',
      timezone: 'Asia/Dubai',
      first_asked_at: new Date(Date.now() - 35.5 * DAY).toISOString(),
      last_asked_at: new Date(Date.now() - 3 * DAY).toISOString(),
      waiting_days: 35,
      times: 2,
      months: 12,
    },
  ],
};
const mockLog = jest.fn();
let mockLogError: Error | null = null;
jest.mock('./overviewApi', () => ({
  useComingUp: () => ({ data: mockData, isPending: false, isError: false, error: null, refetch: jest.fn() }),
  useLogContact: () => ({
    mutateAsync: async (v: unknown) => {
      mockLog(v);
      if (mockLogError) throw mockLogError;
    },
    isPending: false,
    error: mockLogError,
  }),
}));
jest.mock('@/ui/BottomSheet', () => ({
  BottomSheet: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? children : null),
}));

warmUpRendering();

let opened: string[] = [];
beforeEach(() => {
  opened = [];
  mockLog.mockReset();
  mockLogError = null;
  jest.spyOn(Linking, 'openURL').mockImplementation(async (url: string) => {
    opened.push(url);
    return true;
  });
});

async function show(onOpenSalon = jest.fn()) {
  // No clean-up timers (gcTime), so the test run can end.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await renderInApp(
    <QueryClientProvider client={client}>
      <ComingUp onOpenSalon={onOpenSalon} />
    </QueryClientProvider>,
  );
  return onOpenSalon;
}

it('lists what ends soon and the plan requests waiting, each opening its salon', async () => {
  const onOpenSalon = await show();
  expect(screen.getByText('Free periods and pilots ending in the next 7 days: 2')).toBeTruthy();
  expect(screen.getByTestId('console-ending-palm22')).toHaveTextContent(/In free period · ends 28 Nov 2026, in 3 days/);
  expect(screen.getByTestId('console-ending-palm22')).toHaveTextContent(/Omar · العربية/);
  expect(screen.getByTestId('console-ending-palm22')).toHaveTextContent(/WhatsApp \+971 50 123 4567 \(agreed\)/);
  expect(screen.getByTestId('console-ending-cedarcuts')).toHaveTextContent(/Pilot · ends today/);
  expect(screen.getByTestId('console-request-bluecomb')).toHaveTextContent(/waiting 35 days · 12 months · asked 2 times/);
  await fireEvent.press(screen.getByTestId('console-extend-palm22'));
  expect(onOpenSalon).toHaveBeenLastCalledWith('palm22');
  await fireEvent.press(screen.getByTestId('console-request-bluecomb'));
  expect(onOpenSalon).toHaveBeenLastCalledWith('bluecomb');
});

it('writes to the owner in their language, logs it, then opens WhatsApp', async () => {
  await show();
  await fireEvent.press(screen.getByTestId('console-message-palm22'));
  await waitFor(() => expect(screen.getByTestId('console-message-text')).toHaveTextContent(/مرحبًا/));
  expect(screen.getByTestId('console-message-text')).toHaveTextContent(/Palm Salon/);
  expect(screen.getByTestId('console-message-sheet')).toHaveTextContent(/To the owner of Palm Salon, in العربية/);
  await act(async () => fireEvent.press(screen.getByTestId('console-message-whatsapp')));
  expect(mockLog).toHaveBeenCalledWith({ business: 'b-1', channel: 'whatsapp' });
  expect(opened).toHaveLength(1);
  expect(opened[0]).toMatch(/^https:\/\/wa\.me\/971501234567\?text=/);
  expect(decodeURIComponent(opened[0]!.split('text=')[1]!)).toMatch(/Saloqo/);
});

it('no WhatsApp without the owner’s OK: email, with a subject', async () => {
  await show();
  await fireEvent.press(screen.getByTestId('console-message-cedarcuts'));
  await waitFor(() => expect(screen.getByTestId('console-message-text')).toHaveTextContent(/^Hello,/));
  expect(screen.queryByTestId('console-message-whatsapp')).toBeNull();
  await act(async () => fireEvent.press(screen.getByTestId('console-message-email')));
  expect(mockLog).toHaveBeenCalledWith({ business: 'b-2', channel: 'email' });
  expect(opened[0]).toMatch(/^mailto:owner@palm\.test\?subject=Your%20Saloqo%20pilot%20ends%20on%2025%20November%202026&body=/);
});

it('if it cannot be logged, nothing opens', async () => {
  mockLogError = new Error('not_allowed');
  await show();
  await fireEvent.press(screen.getByTestId('console-message-palm22'));
  await waitFor(() => expect(screen.getByTestId('console-message-whatsapp')).toBeTruthy());
  await act(async () => fireEvent.press(screen.getByTestId('console-message-whatsapp')));
  expect(mockLog).toHaveBeenCalled();
  expect(opened).toHaveLength(0);
});
