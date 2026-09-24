/**
 * Poppins covers Latin and Devanagari (English, Hindi). IBM Plex Sans Arabic covers Arabic and
 * Urdu. Custom fonts on React Native are picked by family name, not by fontWeight, so each
 * weight is its own family.
 *
 * Poppins has no tabular figures (its digits range from 320 to 677 units wide), so money and
 * counts use IBM Plex Sans Arabic, whose Latin digits are all 600 units — true tabular figures.
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

/** Family for money and counts: fixed-width digits in every language. */
export function numericFontFamily(weight: FontWeightName = 'regular'): FontFamily {
  return FAMILIES.arabic[weight];
}

/**
 * IBM Plex Sans Arabic needs about 1.5× its size per line (ascent 1085 + descent 415 per 1000),
 * more than the type scale gives Poppins. Arabic/Urdu text gets taller lines so marks above and
 * below letters are never clipped.
 */
export function lineHeightFor(language: Language, fontSize: number, lineHeight: number): number {
  return isRtlLanguage(language) ? Math.max(lineHeight, Math.ceil(fontSize * 1.55)) : lineHeight;
}
