/**
 * A pilot application's card says who is who (owner's fix list A3): "Salon: … · Owner: …", the place without the
 * emirate twice, the type, staff and language, the WhatsApp number as a chat link and when it came in.
 */
import { screen } from '@testing-library/react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import type { PilotApplication } from './api';
import { PilotTab, placeLine } from './PilotTab';

const app = (over: Partial<PilotApplication>): PilotApplication => ({
  id: 'a1',
  name: 'Sorry',
  salon_name: 'Demo pilot',
  emirate: 'dubai',
  area: 'Dubai',
  salon_type: 'barber',
  staff_count: 4,
  whatsapp: '+971501234567',
  language: 'en',
  whatsapp_ok: true,
  status: 'new',
  code: null,
  created_at: '2026-10-30T10:05:00Z',
  decided_at: null,
  ...over,
});

const mockApps = [app({}), app({ id: 'a2', salon_name: 'Fade Lab', name: 'Omar', area: 'Al Barsha', language: 'ar', whatsapp_ok: false })];
const mockIdle = { mutate: jest.fn(), isPending: false, error: null, variables: undefined };
const mockDone = (data: unknown) => ({ data, isPending: false, isError: false, error: null, refetch: jest.fn() });
jest.mock('./api', () => ({
  usePilotApplications: () => mockDone(mockApps),
  usePilotCodes: () => mockDone([]),
  useCreatePilotCode: () => mockIdle,
  useDisablePilotCode: () => mockIdle,
  useDecidePilotApplication: () => mockIdle,
}));
// The bottom sheet's animation library does not load in tests; no sheet is opened here.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

it('labels salon and owner, gives the place once, the language by name, a chat link and the time received', async () => {
  await renderInApp(<PilotTab />);
  const card = screen.getByTestId('pilot-app-Demo pilot');
  expect(card).toHaveTextContent(/Salon: Demo pilot · Owner: Sorry/);
  expect(card).toHaveTextContent(/Barber shop · 4 staff · Language: English/);
  expect(card).toHaveTextContent(/OK to message on WhatsApp ✓/);
  expect(card).toHaveTextContent(/Received 30 Oct 2026 · 14:05/);
  expect(card).not.toHaveTextContent(/Dubai · Dubai/);
  expect(screen.getByTestId('pilot-chat-Demo pilot')).toHaveTextContent('+971501234567');

  const other = screen.getByTestId('pilot-app-Fade Lab');
  expect(other).toHaveTextContent(/Dubai · Al Barsha/);
  expect(other).toHaveTextContent(/Language: العربية/);
  expect(other).not.toHaveTextContent(/OK to message/);
});

it('leaves the area out when it only repeats the emirate', () => {
  expect(placeLine('Dubai', 'dubai', 'Dubai')).toBe('Dubai');
  expect(placeLine('Ras Al Khaimah', 'ras_al_khaimah', ' ras al khaimah ')).toBe('Ras Al Khaimah');
  expect(placeLine('Dubai', 'dubai', null)).toBe('Dubai');
  expect(placeLine('Dubai', 'dubai', 'Deira')).toBe('Dubai · Deira');
});
