import { Stack } from 'expo-router';

import { Gate } from '@/features/auth/Gate';
import { useWorkspace } from '@/features/auth/session';
import { useLiveSync } from '@/features/live/useLiveSync';

function LiveStack() {
  const { business, branch } = useWorkspace();
  useLiveSync(business.id, branch.id);
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function AppLayout() {
  return (
    <Gate area="app">
      <LiveStack />
    </Gate>
  );
}
