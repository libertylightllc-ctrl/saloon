/**
 * Route guards. Each area of the app renders only in the session state it belongs to and
 * otherwise sends the user where they should be.
 */
import { Redirect } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

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

/**
 * Someone signed out lands on the sign-in when this device has picked a salon type, else on the home page. Except the
 * website's bare address (saloqo.com): it always opens on the home page (owner, 2026-10-17: "https://www.saloqo.com/ it
 * not live"), whose "Sign in" still goes straight on. Signing out keeps going to the sign-in (a shared till).
 */
// Read once, when the page opens: the router moves on from "/" before the session is known.
const page = { openedAtSiteAddress: Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname === '/' };

function signedOutHome(salonType: unknown): '/sign-in' | '/welcome' {
  return salonType && !page.openedAtSiteAddress ? '/sign-in' : '/welcome';
}

const HOME: Record<Exclude<SessionStatus, 'loading'>, Area> = {
  signedOut: 'auth',
  error: 'auth',
  needsSetup: 'setup',
  ready: 'app',
};

export function Gate({ area, children }: { area: Area; children: ReactNode }) {
  const { status, platformOnly } = useSession();
  const { salonType, loaded } = useSalonType();
  // Once signed in, a later sign-out (or a login switched off) is not the site opening: back to the sign-in.
  useEffect(() => {
    if (status === 'ready' || status === 'needsSetup') page.openedAtSiteAddress = false;
  }, [status]);
  if (status === 'loading' || !loaded) return <Splash />;
  const target = HOME[status];
  if (target === area) return <>{children}</>;
  if (target === 'auth') return <Redirect href={signedOutHome(salonType)} />;
  // A platform owner whose salon was closed has no salon to set up again: the console is their place.
  if (target === 'setup') return <Redirect href={platformOnly ? '/console' : '/setup'} />;
  return <Redirect href="/" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
