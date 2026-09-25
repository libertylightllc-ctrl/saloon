jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Node 20 has no global WebSocket; supabase-js only needs the constructor to exist.
if (!('WebSocket' in globalThis)) {
  Object.assign(globalThis, { WebSocket: class {} });
}
