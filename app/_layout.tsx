import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fontAssets } from '@/lib/fonts';
import { DEFAULT_LANGUAGE, i18n, initI18n } from '@/lib/i18n';
import { bootstrapLanguage } from '@/lib/language';
import { DEFAULT_MODE, DirectionProvider, loadStoredMode, ThemeProvider, type Mode } from '@/theme';
import { ToastProvider } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

async function start(): Promise<Mode> {
  try {
    await bootstrapLanguage();
  } catch (error) {
    console.warn('Language setup failed; using English.', error);
    await initI18n(DEFAULT_LANGUAGE);
  }
  return loadStoredMode();
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    start()
      .then(setMode)
      .catch(() => setMode(DEFAULT_MODE));
  }, []);

  // A font that fails to load falls back to the system font rather than blocking the app.
  const ready = (fontsLoaded || fontError !== null) && mode !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.fill}>
          <ThemeProvider initialMode={mode}>
            <DirectionProvider>
              <BottomSheetModalProvider>
                <ToastProvider>
                  <StatusBar style="dark" />
                  <Stack screenOptions={{ headerShown: false }} />
                </ToastProvider>
              </BottomSheetModalProvider>
            </DirectionProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
