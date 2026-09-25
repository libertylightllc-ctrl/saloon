import { Stack } from 'expo-router';

import { Gate } from '@/features/auth/Gate';

export default function AuthLayout() {
  return (
    <Gate area="auth">
      <Stack screenOptions={{ headerShown: false }} />
    </Gate>
  );
}
