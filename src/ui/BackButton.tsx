import { usePathname, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { parentPath } from '@/lib/navigation';
import { tapTarget, useTheme } from '@/theme';

import { Icon } from './Icon';
import { useOnBand } from './layoutContext';

/**
 * Gents: white arrow on the violet band (white circle with a dark arrow on light screens).
 * Ladies: filled coral 32-px rounded square with a white chevron.
 */
export function BackButton({ onPress }: { onPress?: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  // No history (refreshed page, deep link): go to the parent screen instead of doing nothing.
  const back = () => (router.canGoBack() ? router.back() : router.replace(parentPath(pathname) as Href));
  const onBand = useOnBand();
  const square = theme.variants.iconButton === 'square';
  const size = square ? 32 : 40;
  const background = square
    ? theme.colors.primary500
    : onBand
      ? 'transparent'
      : theme.colors.surface;
  const ink = square || onBand ? theme.colors.onPrimary : theme.colors.text;

  return (
    <Pressable
      onPress={onPress ?? back}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={(tapTarget - size) / 2 + 2}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: square ? theme.radius.sm : size / 2,
          backgroundColor: background,
        },
        !square && !onBand && theme.shadow,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        name={square ? 'chevronLeft' : 'arrowLeft'}
        size={square ? 18 : 22}
        strokeWidth={square ? 2.25 : 2}
        color={ink}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
});
