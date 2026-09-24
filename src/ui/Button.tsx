import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { semantic, spacing, useTheme, type TypeVariant } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'inverse';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  /** primary = filled · secondary = tinted ("Book now") · outline · ghost · danger · inverse = white on colour */
  variant?: ButtonVariant;
  /** lg = full width · md · sm */
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  loading,
  disabled,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const { colors } = theme;
  const inactive = disabled || loading;

  const palette = {
    primary: {
      bg: colors.primaryAction,
      pressed: colors.primaryActionPressed,
      fg: colors.onPrimary,
    },
    secondary: { bg: colors.primary50, pressed: colors.primary100, fg: colors.primaryText },
    outline: { bg: 'transparent', pressed: colors.primary50, fg: colors.primaryText },
    ghost: { bg: 'transparent', pressed: colors.primary50, fg: colors.primaryText },
    danger: { bg: semantic.error.hover, pressed: semantic.error.pressed, fg: colors.onPrimary },
    inverse: { bg: colors.surface, pressed: colors.primary50, fg: colors.primaryText },
  }[variant];

  const height = { lg: theme.sizes.buttonLg, md: theme.sizes.buttonMd, sm: theme.sizes.buttonSm }[
    size
  ];
  // Small actions are pills in the Barber kit, small rounded rectangles in Fashly.
  const radius =
    size === 'sm' && theme.variants.listAction === 'tinted'
      ? theme.radius.pill
      : size === 'sm'
        ? theme.radius.sm
        : theme.radius.button;
  const textVariant: TypeVariant = size === 'lg' ? 'h4' : size === 'md' ? 'bodyStrong' : 'small';
  const fg = inactive ? colors.textDisabled : palette.fg;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          borderRadius: radius,
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl,
          backgroundColor: inactive
            ? variant === 'ghost' || variant === 'outline'
              ? 'transparent'
              : colors.inputFill
            : pressed
              ? palette.pressed
              : palette.bg,
        },
        size === 'lg' && styles.full,
        variant === 'outline' && {
          borderWidth: 1,
          borderColor: inactive ? colors.neutral.n50 : colors.primary500,
        },
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={fg} /> : null}
          <Text
            variant={textVariant}
            weight={size === 'sm' ? 'medium' : 'semibold'}
            style={{ color: fg }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { transform: [{ scale: 0.98 }] },
});
