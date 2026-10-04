import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Gate } from '@/features/auth/Gate';
import { useKeepRemembered } from '@/features/auth/useKeepRemembered';
import { useWorkspace } from '@/features/auth/session';
import { useLiveSync } from '@/features/live/useLiveSync';
import { SideNav, useNavRoots } from '@/features/nav/SideNav';
import { NavRootsContext } from '@/ui';
import { usePush } from '@/features/notifications/usePush';

function LiveStack() {
  const { business, branch, member, role } = useWorkspace();
  useLiveSync(business.id, branch.id, member.id, role === 'owner' || role === 'accountant');
  usePush(business.id);
  useKeepRemembered();
  const roots = useNavRoots();
  // Tablets and computers: the side navigation stays put while pages change beside it (phones: the tab bar).
  return (
    <NavRootsContext.Provider value={roots}>
      <View style={styles.row}>
        <SideNav />
        <View style={styles.page}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    </NavRootsContext.Provider>
  );
}

export default function AppLayout() {
  return (
    <Gate area="app">
      <LiveStack />
    </Gate>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  page: { flex: 1, minWidth: 0 },
});
