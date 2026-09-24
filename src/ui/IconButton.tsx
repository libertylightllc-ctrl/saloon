import { Pressable, StyleSheet, View } from 'react-native';

import { semantic, tapTarget, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface IconButtonProps {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  /** surface = white with tinted shadow · filled = primary · tinted = soft primary · plain = icon only */
  variant?: 'surface' | 'filled' | 'tinted' | 'plain';
  size?: number;
  /** A number shows a count bubble; `true` shows a dot. */
  badge?: number | boolean;
  disabled?: boolean;
}

/** Round in gents, rounded-square in ladies. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'surface',
  size = 40,
  badge,
  disabled,
}: IconButtonProps) {
  const theme = useTheme();
  const { colors } = theme;
  const square = theme.variants.iconButton === 'square';
  const background = {
    surface: colors.surface,
    filled: colors.primaryAction,
    tinted: colors.primary50,
    plain: 'transparent',
  }[variant];
  const iconColor = {
    surface: colors.text,
    filled: colors.onPrimary,
    tinted: colors.primary500,
    plain: colors.text,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={Math.max(0, (tapTarget - size) / 2)}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: square ? theme.radius.sm : size / 2,
          backgroundColor: background,
        },
        variant === 'surface' && theme.shadow,
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={iconColor} />
      {badge ? (
        <View
          style={[
            styles.badge,
            typeof badge === 'number' ? styles.count : styles.dot,
            { backgroundColor: semantic.error.hover, borderColor: colors.surface },
          ]}
        >
          {typeof badge === 'number' ? (
            <Text variant="micro" color="onPrimary" align="center" tabular>
              {badge > 9 ? '9+' : String(badge)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.6 },
  badge: { position: 'absolute', top: 4, end: 4, borderWidth: 1.5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 3,
    top: -2,
    end: -2,
    justifyContent: 'center',
  },
});
