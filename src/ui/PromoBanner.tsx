import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Button } from './Button';
import { ContourPattern } from './ContourPattern';
import { Illustration, type IllustrationName } from './Illustration';
import { ProgressDashes } from './ProgressDashes';
import { Text } from './Text';

export interface PromoBannerProps {
  title: string;
  body?: string;
  actionLabel: string;
  onAction?: () => void;
  illustration?: IllustrationName;
  /** Setup progress, e.g. 4 of 6 steps. */
  progress?: { done: number; total: number };
}

/**
 * Gents: violet card, white text, white pill button, art on the end side (Barber "30% Off").
 * Ladies: soft coral card, dark heading, white rectangular button (Fashly "50% off").
 */
export function PromoBanner({
  title,
  body,
  actionLabel,
  onAction,
  illustration,
  progress,
}: PromoBannerProps) {
  const theme = useTheme();
  const band = theme.variants.promo === 'band';

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: theme.radius.lg,
          backgroundColor: band ? theme.colors.primary500 : theme.colors.primary200,
        },
      ]}
    >
      {band ? <ContourPattern color={theme.colors.primary300} /> : null}
      <View style={styles.text}>
        <Text variant={band ? 'h3' : 'h2'} weight="bold" color={band ? 'onPrimary' : 'text'}>
          {title}
        </Text>
        {body ? (
          <Text variant="small" color={band ? 'onPrimary' : 'textOnTint'} numberOfLines={2}>
            {body}
          </Text>
        ) : null}
        {progress ? (
          <ProgressDashes
            total={progress.total}
            current={progress.done}
            mode="progress"
            onBand={band}
          />
        ) : null}
        <View style={styles.action}>
          {band ? (
            <Button label={actionLabel} onPress={onAction} variant="inverse" size="sm" />
          ) : (
            <Pressable
              onPress={onAction}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              style={({ pressed }) => [
                styles.rectButton,
                { backgroundColor: theme.colors.surface, borderRadius: 4 },
                pressed && styles.pressed,
              ]}
            >
              <Text variant="bodyStrong" weight="semibold">
                {actionLabel}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
      {illustration ? <Illustration name={illustration} size={96} onBand={band} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
    minHeight: 148,
  },
  text: { flex: 1, gap: spacing.sm },
  action: { flexDirection: 'row', marginTop: spacing.xs },
  rectButton: { height: 36, paddingHorizontal: spacing.xl, justifyContent: 'center' },
  pressed: { opacity: 0.8 },
});
