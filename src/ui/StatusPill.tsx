import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { semantic, spacing, useTheme, type Tone } from '@/theme';

import { Text } from './Text';

export const STATUS_TONE = {
  booked: 'primary',
  waiting: 'warning',
  in_progress: 'info',
  completed: 'success',
  paid: 'success',
  approved: 'success',
  valid: 'success',
  no_show: 'error',
  overdue: 'error',
  expired: 'error',
  out_of_stock: 'error',
  pending_approval: 'warning',
  due_soon: 'warning',
  low: 'warning',
  cancelled: 'neutral',
  reversed: 'neutral',
  archived: 'neutral',
} as const satisfies Record<string, Tone>;

export type StatusKey = keyof typeof STATUS_TONE;

/** Surface background + pressed-colour text (white on the main colours fails contrast). */
export function useToneColors(tone: Tone): { fill: string; ink: string; border: string } {
  const { colors } = useTheme();
  if (tone === 'primary')
    return { fill: colors.primary50, ink: colors.primary700, border: colors.primary100 };
  if (tone === 'neutral')
    return { fill: colors.neutral.n20, ink: colors.neutral.n80, border: colors.neutral.n40 };
  const set = semantic[tone];
  return { fill: set.surface, ink: set.pressed, border: set.border };
}

export interface StatusPillProps {
  status?: StatusKey;
  tone?: Tone;
  /** Defaults to the translated status name. */
  label?: string;
}

export function StatusPill({ status, tone, label }: StatusPillProps) {
  const { t } = useTranslation();
  const colors = useToneColors(tone ?? (status ? STATUS_TONE[status] : 'neutral'));
  return (
    <View style={[styles.pill, { backgroundColor: colors.fill }]}>
      <View style={[styles.dot, { backgroundColor: colors.ink }]} />
      <Text variant="small" weight="medium" style={{ color: colors.ink }} numberOfLines={1}>
        {label ?? (status ? t(`status.${status}`) : '')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
