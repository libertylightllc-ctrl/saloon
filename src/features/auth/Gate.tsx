/**
 * Route guards. Each area of the app renders only in the session state it belongs to and
 * otherwise sends the user where they should be.
 */
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { useSalonType } from './salonType';
import { useSession, type SessionStatus } from './session';

export function Splash() {
  const theme = useTheme();
  return (
    <View style={[styles.splash, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator color={theme.colors.primary500} size="large" />
    </View>
  );
}

type Area = 'auth' | 'setup' | 'app';

const HOME: Record<Exclude<SessionStatus, 'loading'>, Area> = {
  signedOut: 'auth',
  error: 'auth',
  needsSetup: 'setup',
  ready: 'app',
};

export function Gate({ area, children }: { area: Area; children: ReactNode }) {
  const { status } = useSession();
  const { salonType, loaded } = useSalonType();
  if (status === 'loading' || !loaded) return <Splash />;
  const target = HOME[status];
  if (target === area) return <>{children}</>;
  if (target === 'auth') return <Redirect href={salonType ? '/sign-in' : '/welcome'} />;
  if (target === 'setup') return <Redirect href="/setup" />;
  return <Redirect href="/" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
