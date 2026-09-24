/**
 * Illustrations by name, per mode. Licensed artwork goes in assets/illustrations/<mode>/ and is
 * registered in SOURCES; until then a tinted placeholder with a line icon is drawn.
 * Never use the reference kits' illustrations — they belong to their designers.
 */
import { Image, View, type ImageSourcePropType } from 'react-native';

import { useTheme, type Mode } from '@/theme';

import { Icon, type IconName } from './Icon';

const PLACEHOLDER_ICON = {
  'onboarding-1': 'calendarClock',
  'onboarding-2': 'users',
  'onboarding-3': 'banknote',
  'queue-empty': 'armchair',
  'customers-empty': 'contact',
  'stock-ok': 'boxes',
  'compliance-ok': 'shield',
  'setup-done': 'circleCheck',
  'promo-setup': 'rocket',
  'sale-done': 'partyPopper',
  'no-results': 'searchX',
} as const satisfies Record<string, IconName>;

export type IllustrationName = keyof typeof PLACEHOLDER_ICON;

/** Width ÷ height. */
const ASPECT: Partial<Record<IllustrationName, number>> = {
  'onboarding-1': 0.9,
  'onboarding-2': 0.9,
  'onboarding-3': 0.9,
};

const SOURCES: Record<Mode, Partial<Record<IllustrationName, ImageSourcePropType>>> = {
  gents: {},
  ladies: {},
};

export interface IllustrationProps {
  name: IllustrationName;
  /** Width in points. */
  size?: number;
  /** Softer placeholder for use on the violet band. */
  onBand?: boolean;
}

export function Illustration({ name, size = 160, onBand }: IllustrationProps) {
  const theme = useTheme();
  const aspect = ASPECT[name] ?? 1;
  const height = Math.round(size / aspect);
  const source = SOURCES[theme.mode][name];

  if (source) {
    return (
      <Image
        source={source}
        style={{ width: size, height }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    );
  }

  const circle = Math.round(Math.min(size, height) * 0.62);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height,
        borderRadius: theme.radius.lg,
        backgroundColor: onBand ? theme.colors.primary400 : theme.colors.primary50,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: circle,
          height: circle,
          borderRadius: circle / 2,
          backgroundColor: onBand ? theme.colors.primary300 : theme.colors.primary100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          name={PLACEHOLDER_ICON[name]}
          size={Math.round(circle * 0.42)}
          strokeWidth={1.5}
          color={onBand ? theme.colors.onPrimary : theme.colors.primary500}
        />
      </View>
    </View>
  );
}
