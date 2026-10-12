import { Stack } from 'expo-router';

import { Gate } from '@/features/auth/Gate';

// While a sign-in is checked the Gate shows its splash in place of these screens; when they come back (a login that is
// switched off is signed out again), they start from sign-in, where the reason is shown — never from whichever screen
// happens to come first (2026-10-12: it became Contact us).
export const unstable_settings = { initialRouteName: 'sign-in' };

export default function AuthLayout() {
  return (
    <Gate area="auth">
      <Stack screenOptions={{ headerShown: false }} />
    </Gate>
  );
}
