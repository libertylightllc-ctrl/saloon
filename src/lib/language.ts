/**
 * The app language is chosen per device and remembered. Arabic and Urdu are right-to-left.
 *
 * React Native only applies a direction change after a restart, so switching between an LTR
 * and an RTL language reloads the app. On web (dev preview only) the <html dir> flips instead.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import { I18nManager, Platform } from 'react-native';

import { DEFAULT_LANGUAGE, initI18n, isLanguage, isRtlLanguage, type Language } from './i18n';

const LANGUAGE_KEY = 'settings.language';
/** Set just before a direction reload so a device that refuses RTL cannot reload forever. */
const DIRECTION_RELOAD_KEY = 'settings.directionReload';

/** Stored choice first, then the first supported device language, then English. */
export function pickLanguage(
  stored: string | null,
  deviceLanguageCodes: readonly (string | null)[],
): Language {
  if (isLanguage(stored)) return stored;
  return deviceLanguageCodes.find(isLanguage) ?? DEFAULT_LANGUAGE;
}

async function readStored(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Sets the layout direction for a language.
 * Returns true when the running app still has the other direction and must reload.
 */
function applyDirection(language: Language): boolean {
  const rtl = isRtlLanguage(language);
  if (Platform.OS === 'web') {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    return false;
  }
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return I18nManager.isRTL !== rtl;
}

/** Called once at start-up, before the first screen renders. */
export async function bootstrapLanguage(): Promise<Language> {
  const stored = await readStored(LANGUAGE_KEY);
  const language = pickLanguage(
    stored,
    getLocales().map((l) => l.languageCode),
  );
  await initI18n(language);

  if (applyDirection(language)) {
    const alreadyTried = (await readStored(DIRECTION_RELOAD_KEY)) === language;
    if (!alreadyTried) {
      await AsyncStorage.setItem(DIRECTION_RELOAD_KEY, language);
      await reloadAppAsync('Layout direction changed');
    }
  } else {
    await AsyncStorage.removeItem(DIRECTION_RELOAD_KEY);
  }
  return language;
}

/** The language picker calls this. The app reloads if the direction flips. */
export async function changeLanguage(language: Language): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
  await initI18n(language);
  if (applyDirection(language)) {
    await AsyncStorage.setItem(DIRECTION_RELOAD_KEY, language);
    await reloadAppAsync('Layout direction changed');
  }
}
