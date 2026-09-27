import { Stack } from 'expo-router';

import { Gate } from '@/features/auth/Gate';
import { useWorkspace } from '@/features/auth/session';
import { useLiveSync } from '@/features/live/useLiveSync';
import { usePush } from '@/features/notifications/usePush';

function LiveStack() {
  const { business, branch, member, role } = useWorkspace();
  useLiveSync(business.id, branch.id, member.id, role === 'owner' || role === 'accountant');
  usePush(business.id);
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function AppLayout() {
  return (
    <Gate area="app">
      <LiveStack />
    </Gate>
  );
}
