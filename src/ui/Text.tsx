import { useTranslation } from 'react-i18next';
import {
  Platform,
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { fontFamily } from '@/lib/fonts';
import { DEFAULT_LANGUAGE, isLanguage } from '@/lib/i18n';
import {
  tabularNums,
  typeScale,
  useTheme,
  type FontWeightName,
  type ThemeColors,
  type TypeVariant,
} from '@/theme';

type StringKeys<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];
export type ColorToken = StringKeys<ThemeColors>;

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: ColorToken;
  weight?: FontWeightName;
  align?: 'start' | 'center' | 'end';
  /** Tabular figures for money and counts. */
  tabular?: boolean;
}

/**
 * Text aligned to the layout's start edge. Native swaps left/right in RTL; web understands
 * start/end directly. Without this, Latin text (brand, amounts) would hug the left in Arabic.
 */
const ALIGN: Record<NonNullable<TextProps['align']>, TextStyle['textAlign']> = {
  start: Platform.OS === 'web' ? ('start' as TextStyle['textAlign']) : 'left',
  center: 'center',
  end: Platform.OS === 'web' ? ('end' as TextStyle['textAlign']) : 'right',
};

export const START_ALIGN = ALIGN.start;

export function useFontFamily() {
  const { i18n } = useTranslation();
  const language = isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
  return (weight: FontWeightName) => fontFamily(language, weight);
}

export function Text({
  variant = 'body',
  color = 'text',
  weight,
  align = 'start',
  tabular,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const font = useFontFamily();
  const type = typeScale[variant];
  return (
    <RNText
      style={[
        {
          fontFamily: font(weight ?? type.weight),
          fontSize: type.fontSize,
          lineHeight: type.lineHeight,
          color: theme.colors[color],
          textAlign: ALIGN[align],
        },
        tabular && tabularNums,
        style,
      ]}
      {...rest}
    />
  );
}
