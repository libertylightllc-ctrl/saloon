/**
 * A screen that crashes says "Something went wrong. Try again." instead of going blank, and the platform owners are
 * told (owner's brief, Part B, B10) without an email address or phone number in the text.
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import { AppErrorBoundary } from './AppErrorBoundary';
import { errorText } from './report';

const mockRpc = jest.fn(() => Promise.resolve({ data: null, error: null }));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...(args as [])) } }));
jest.mock('@/features/auth/session', () => ({ useSession: () => ({ member: { business_id: 'b-1', active: true } }) }));
let mockPath = '/sale';
jest.mock('expo-router', () => ({ usePathname: () => mockPath, router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() } }));

// The bottom sheet's animation library does not load in tests; no sheet is opened here.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

let mockBroken = true;
function Flaky() {
  if (mockBroken) throw new Error('Cannot read properties of undefined (reading total) for sara@example.com +971 50 123 4567');
  return <Text>Fine</Text>;
}

it('shows a way back, tells the platform owners, and tries again', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await renderInApp(
    <AppErrorBoundary>
      <Flaky />
    </AppErrorBoundary>,
  );
  expect(screen.getByTestId('app-crashed')).toHaveTextContent(/Something went wrong\. Try again\./);
  expect(mockRpc).toHaveBeenCalledWith('report_app_error', {
    p_message: 'Error: Cannot read properties of undefined (reading total) for [email] [number]',
    p_screen: '/sale',
    p_business: 'b-1',
  });
  mockBroken = false;
  await fireEvent.press(screen.getByText('Try again'));
  expect(screen.getByText('Fine')).toBeTruthy();
});

function Counter() {
  const [n, setN] = useState(0);
  return (
    <Pressable onPress={() => setN(n + 1)} testID="count">
      <Text>{`Count ${n}`}</Text>
    </Pressable>
  );
}

it('moving to another screen keeps the app as it is (no rebuild); after a crash, it starts clear', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  mockPath = '/';
  const view = await renderInApp(
    <AppErrorBoundary>
      <Counter />
    </AppErrorBoundary>,
  );
  await fireEvent.press(screen.getByTestId('count'));
  mockPath = '/welcome';
  await view.rerender(
    <AppErrorBoundary>
      <Counter />
    </AppErrorBoundary>,
  );
  expect(screen.getByText('Count 1')).toBeTruthy();

  mockBroken = true;
  mockPath = '/sale';
  await view.rerender(
    <AppErrorBoundary>
      <Flaky />
    </AppErrorBoundary>,
  );
  expect(screen.getByTestId('app-crashed')).toBeTruthy();
  mockBroken = false;
  mockPath = '/sale';
  await view.rerender(
    <AppErrorBoundary>
      <Flaky />
    </AppErrorBoundary>,
  );
  expect(screen.getByTestId('app-crashed')).toBeTruthy();
  mockPath = '/customers';
  await view.rerender(
    <AppErrorBoundary>
      <Flaky />
    </AppErrorBoundary>,
  );
  expect(screen.getByText('Fine')).toBeTruthy();
});

it('keeps the error text short', () => {
  expect(errorText(new Error('x'.repeat(900)))).toHaveLength(500);
  expect(errorText('plain')).toBe('plain');
});
