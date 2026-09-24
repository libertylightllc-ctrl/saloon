import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fontAssets } from '@/lib/fonts';
import { DEFAULT_LANGUAGE, i18n, initI18n } from '@/lib/i18n';
import { bootstrapLanguage } from '@/lib/language';

SplashScreen.preventAutoHideAsync().catch(() => {});

async function startLanguage() {
  try {
    await bootstrapLanguage();
  } catch (error) {
    console.warn('Language setup failed; using English.', error);
    await initI18n(DEFAULT_LANGUAGE);
  }
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
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </I18nextProvider>
  );
}
