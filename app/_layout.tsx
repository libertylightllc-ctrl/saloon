import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SalonTypeProvider, useSalonType } from '@/features/auth/salonType';
import { SessionProvider, useSession } from '@/features/auth/session';
import { fontAssets } from '@/lib/fonts';
import { DEFAULT_LANGUAGE, i18n, initI18n } from '@/lib/i18n';
import { bootstrapLanguage } from '@/lib/language';
import { queryClient } from '@/lib/queryClient';
import { DEFAULT_MODE, DirectionProvider, ThemeProvider } from '@/theme';
import { ToastProvider } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

async function startLanguage() {
  try {
    await bootstrapLanguage();
  } catch (error) {
    console.warn('Language setup failed; using English.', error);
    await initI18n(DEFAULT_LANGUAGE);
  }
}

/** Signed in: the branch's mode. Before that: the salon type chosen on this device. */
function AppTheme({ children }: { children: ReactNode }) {
  const { branch } = useSession();
  const { salonType } = useSalonType();
  return <ThemeProvider mode={branch?.mode ?? salonType ?? DEFAULT_MODE}>{children}</ThemeProvider>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [languageReady, setLanguageReady] = useState(false);

  useEffect(() => {
    startLanguage().finally(() => setLanguageReady(true));
  }, []);

  // A font that fails to load falls back to the system font rather than blocking the app.
  const ready = (fontsLoaded || fontError !== null) && languageReady;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.fill}>
            <SalonTypeProvider>
              <SessionProvider>
                <AppTheme>
                  <DirectionProvider>
                    {/* Toasts wrap the sheet host so forms inside sheets can raise them, and draw above sheets. */}
                    <ToastProvider>
                      <BottomSheetModalProvider>
                        <Stack screenOptions={{ headerShown: false }} />
                      </BottomSheetModalProvider>
                    </ToastProvider>
                  </DirectionProvider>
                </AppTheme>
              </SessionProvider>
            </SalonTypeProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
