/**
 * The app says when a login opens it, and in which language (owner's brief, Part B): once when it starts, again when
 * the language changes, not again within the hour.
 */
import { renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useLastSeen } from './useLastSeen';

const mockRpc = jest.fn(() => Promise.resolve({ data: null, error: null }));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...(args as [])) } }));
let mockMember: { business_id: string; active: boolean } | null = { business_id: 'b-1', active: true };
jest.mock('./session', () => ({ useSession: () => ({ member: mockMember }) }));
let mockLanguage = 'en';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: mockLanguage } }) }));

beforeEach(() => {
  mockRpc.mockClear();
  mockMember = { business_id: 'b-1', active: true };
  mockLanguage = 'en';
});

it('once on start, again on a new language, not again on coming back within the hour', async () => {
  const { rerender } = await renderHook(() => useLastSeen());
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenLastCalledWith('touch_seen', { p_business: 'b-1', p_language: 'en' });
  // Back to the app a moment later.
  (AppState as unknown as { emit?: (e: string, s: string) => void }).emit?.('change', 'active');
  await rerender({});
  expect(mockRpc).toHaveBeenCalledTimes(1);
  mockLanguage = 'ar';
  await rerender({});
  expect(mockRpc).toHaveBeenCalledTimes(2);
  expect(mockRpc).toHaveBeenLastCalledWith('touch_seen', { p_business: 'b-1', p_language: 'ar' });
});

it('says nothing without a salon login, or for a switched-off one', async () => {
  mockMember = null;
  await renderHook(() => useLastSeen());
  mockMember = { business_id: 'b-1', active: false };
  await renderHook(() => useLastSeen());
  expect(mockRpc).not.toHaveBeenCalled();
});
