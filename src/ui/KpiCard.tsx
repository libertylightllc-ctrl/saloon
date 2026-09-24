import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { semantic, spacing, useTheme } from '@/theme';

import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface KpiDelta {
  /** e.g. "12%" */
  label: string;
  trend: 'up' | 'down';
  /** Whether this change is good news. Defaults to up = good. */
  good?: boolean;
}

export interface KpiCardProps {
  label: string;
  value: string;
  delta?: KpiDelta;
  sub?: string;
  icon?: IconName;
  /** Bigger value and an action slot (Home "Expected cash today"). */
  hero?: boolean;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function KpiCard({ label, value, delta, sub, icon, hero, action, style }: KpiCardProps) {
  const theme = useTheme();
  const good = delta ? (delta.good ?? delta.trend === 'up') : true;
  const tone = good ? semantic.success : semantic.error;

  return (
    <Card
      style={[hero ? styles.hero : styles.card, style]}
      padding={hero ? spacing.xl : spacing.lg}
    >
      <View style={styles.labelRow}>
        {icon ? (
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary50 }]}>
            <Icon name={icon} size={16} color={theme.colors.primary500} />
          </View>
        ) : null}
        <Text variant="small" color="textSecondary" numberOfLines={1} style={styles.flex}>
          {label}
        </Text>
      </View>
      <Text
        variant={hero ? 'display' : 'h3'}
        weight="bold"
        tabular
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <View style={styles.footer}>
        <View style={[styles.flex, styles.subRow]}>
          {delta ? (
            <View style={[styles.delta, { backgroundColor: tone.surface }]}>
              <Text variant="micro" style={{ color: tone.pressed }} tabular>
                {`${delta.trend === 'up' ? '▲' : '▼'} ${delta.label}`}
              </Text>
            </View>
          ) : null}
          {sub ? (
            <Text variant="small" color="textSecondary" numberOfLines={2} style={styles.flex}>
              {sub}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, minWidth: 156 },
  hero: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flexShrink: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  delta: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
