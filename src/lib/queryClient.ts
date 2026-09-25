import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { errorCode } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // Retry network blips once; permission and validation errors never fix themselves.
      retry: (count, error) => count < 1 && errorCode(error) === 'no_internet',
      // Always try: offline shows "No connection" with a retry instead of an endless spinner.
      networkMode: 'always',
    },
    mutations: { retry: false, networkMode: 'always' },
  },
});

// Refetch when the app comes back to the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}
