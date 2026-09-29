import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { semantic, spacing } from '@/theme';
import { Card, Text } from '@/ui';

import type { OwnerControl } from './api';

/** The four control facts as short sentences (also printed on every report PDF). */
export function useControlWords() {
  const { t } = useTranslation();
  const dates = useDates();
  return (c: OwnerControl): string[] => {
    const close =
      c.last_close_date === null
        ? t('reports.control.noClose')
        : t(
            c.last_close_variance_minor ? (c.last_close_variance_minor < 0 ? 'reports.control.closeShort' : 'reports.control.closeOver') : 'reports.control.closeBalanced',
            { date: dates.day(c.last_close_date, 'EEE d MMM'), amount: formatMoney(Math.abs(c.last_close_variance_minor ?? 0)) },
          );
    return [
      close,
      t('reports.control.suppliers', { amount: formatMoney(c.supplier_owed_minor) }),
      t('reports.control.lowItems', { count: c.low_items }),
      ...(c.compliance_issues === null ? [] : [t('reports.control.compliance', { count: c.compliance_issues })]),
    ];
  };
}

/** "Owner control summary": latest close difference, supplier balances, low items, compliance issues. */
export function ControlLine({ query }: { query: UseQueryResult<OwnerControl> }) {
  const { t } = useTranslation();
  const words = useControlWords();
  if (!query.data) return null;
  const c = query.data;
  const flags = [
    (c.last_close_variance_minor ?? 0) !== 0,
    c.supplier_owed_minor > 0,
    c.low_items > 0,
    (c.compliance_issues ?? 0) > 0,
  ];
  return (
    <Card variant="outlined" style={styles.card} testID="report-control">
      <Text variant="small" color="textSecondary">
        {t('reports.control.title')}
      </Text>
      <View style={styles.items}>
        {words(c).map((w, i) => (
          <View key={w} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: flags[i] ? semantic.warning.main : semantic.success.main }]} />
            <Text variant="small" style={styles.flex}>
              {w}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  items: { gap: spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1 },
});
