import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './Icon';

/** Gents: white circle with a dark arrow. Ladies: small coral rounded square, white chevron. */
export function BackButton({ onPress }: { onPress?: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const square = theme.variants.iconButton === 'square';
  const size = square ? 32 : 40;

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={(44 - size) / 2 + 2}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: square ? theme.radius.sm : size / 2,
          backgroundColor: square ? theme.colors.primary500 : theme.colors.surface,
        },
        !square && theme.shadow,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        name={square ? 'chevronLeft' : 'arrowLeft'}
        size={square ? 18 : 20}
        strokeWidth={square ? 2.25 : 1.75}
        color={square ? theme.colors.onPrimary : theme.colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
});
