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

import { visitorCountry } from './geo';
import { DEFAULT_LANGUAGE, initI18n, isLanguage, isRtlLanguage, type Language } from './i18n';

const LANGUAGE_KEY = 'settings.language';
/** Set just before a direction reload so a device that refuses RTL cannot reload forever. */
const DIRECTION_RELOAD_KEY = 'settings.directionReload';

/** The main language of a country, where the app has it (owner, 2026-10-12: a phone in a language the app lacks
 * opens in the language of the country it is in). */
const COUNTRY_LANGUAGE: Record<string, Language> = {
  ...Object.fromEntries(
    ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'EG', 'JO', 'LB', 'IQ', 'SY', 'YE', 'PS', 'MA', 'DZ', 'TN', 'LY', 'SD', 'MR']
      .map((c) => [c, 'ar' as const]),
  ),
  ...Object.fromEntries(
    ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR', 'GQ']
      .map((c) => [c, 'es' as const]),
  ),
  ...Object.fromEntries(
    ['FR', 'MC', 'SN', 'CI', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GA', 'CG', 'CD', 'GN', 'MG', 'HT', 'CM', 'TD']
      .map((c) => [c, 'fr' as const]),
  ),
  ...Object.fromEntries(['BR', 'PT', 'AO', 'MZ', 'CV', 'GW', 'ST'].map((c) => [c, 'pt' as const])),
  IN: 'hi',
  PK: 'ur',
};

export function countryLanguage(country: string | null | undefined): Language | null {
  return (country && COUNTRY_LANGUAGE[country]) || null;
}

/**
 * Stored choice first, then the first supported device language, then the language of the country the device is in
 * (owner, 2026-10-12: "phone language, then location"), then English.
 */
export function pickLanguage(
  stored: string | null,
  deviceLanguageCodes: readonly (string | null)[],
  country?: string | null,
): Language {
  if (isLanguage(stored)) return stored;
  return deviceLanguageCodes.find(isLanguage) ?? countryLanguage(country) ?? DEFAULT_LANGUAGE;
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
  const device = getLocales().map((l) => l.languageCode);
  // The country is asked only when neither a choice nor the device settles it.
  const settled = isLanguage(stored) || device.some(isLanguage);
  const language = pickLanguage(stored, device, settled ? null : await visitorCountry(1200));
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
