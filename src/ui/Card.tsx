import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { spacing, useTheme } from '@/theme';

export interface CardProps {
  children: ReactNode;
  /** elevated = tinted shadow · outlined = 1-px border (cards on white) · tinted = soft primary */
  variant?: 'elevated' | 'outlined' | 'tinted';
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  variant = 'elevated',
  padding = spacing.lg,
  onPress,
  accessibilityLabel,
  style,
}: CardProps) {
  const theme = useTheme();
  const look: StyleProp<ViewStyle> = [
    {
      borderRadius: theme.radius.lg,
      padding,
      backgroundColor: variant === 'tinted' ? theme.colors.primary50 : theme.colors.surface,
    },
    variant === 'elevated' && theme.shadow,
    variant === 'outlined' && { borderWidth: 1, borderColor: theme.colors.divider },
    style,
  ];

  if (!onPress) return <View style={look}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [look, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
