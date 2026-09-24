/**
 * Poppins covers Latin and Devanagari (English, Hindi). IBM Plex Sans Arabic covers Arabic and
 * Urdu. Custom fonts on React Native are picked by family name, not by fontWeight, so each
 * weight is its own family.
 */
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

import type { FontWeightName } from '@/theme/tokens';

import { isRtlLanguage, type Language } from './i18n';

export const fontAssets = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
};

type FontFamily = keyof typeof fontAssets;

const FAMILIES: Record<'latin' | 'arabic', Record<FontWeightName, FontFamily>> = {
  latin: {
    regular: 'Poppins_400Regular',
    medium: 'Poppins_500Medium',
    semibold: 'Poppins_600SemiBold',
    bold: 'Poppins_700Bold',
  },
  arabic: {
    regular: 'IBMPlexSansArabic_400Regular',
    medium: 'IBMPlexSansArabic_500Medium',
    semibold: 'IBMPlexSansArabic_600SemiBold',
    bold: 'IBMPlexSansArabic_700Bold',
  },
};

export function fontFamily(language: Language, weight: FontWeightName = 'regular'): FontFamily {
  return FAMILIES[isRtlLanguage(language) ? 'arabic' : 'latin'][weight];
}
