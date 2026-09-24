import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DevStrip } from '@/features/dev/DevStrip';

/** The dev strip takes the status-bar inset, so screens below it start at 0. */
export default function DevLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.fill}>
      <DevStrip />
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
