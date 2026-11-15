import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { semantic, spacing } from '@/theme';
import { Card, Text } from '@/ui';

import type { OwnerControl } from './api';

/** The control facts, each with whether it needs a look (a warning dot on screen). */
function useControlFacts() {
  const { t } = useTranslation();
  const dates = useDates();
  return (c: OwnerControl): { text: string; warn: boolean }[] => {
    const close =
      c.last_close_date === null
        ? t('reports.control.noClose')
        : t(
            c.last_close_variance_minor ? (c.last_close_variance_minor < 0 ? 'reports.control.closeShort' : 'reports.control.closeOver') : 'reports.control.closeBalanced',
            { date: dates.day(c.last_close_date, 'EEE d MMM'), amount: formatMoney(Math.abs(c.last_close_variance_minor ?? 0)) },
          );
    // The days still waiting for a close (E8): the latest three, oldest first, "…" when there are more.
    const shown = c.unclosed_days.slice(0, 3).reverse().map((d) => dates.day(d, 'd MMM'));
    const unclosed = c.unclosed_days.length
      ? [{
          text: t('reports.control.notClosed', {
            count: c.unclosed_days.length,
            dates: `${c.unclosed_days.length > 3 ? '…, ' : ''}${shown.join(', ')}`,
          }),
          warn: true,
        }]
      : [];
    return [
      { text: close, warn: (c.last_close_variance_minor ?? 0) !== 0 },
      ...unclosed,
      { text: t('reports.control.suppliers', { amount: formatMoney(c.supplier_owed_minor) }), warn: c.supplier_owed_minor > 0 },
      { text: t('reports.control.lowItems', { count: c.low_items }), warn: c.low_items > 0 },
      ...(c.compliance_issues === null
        ? []
        : [{ text: t('reports.control.compliance', { count: c.compliance_issues }), warn: c.compliance_issues > 0 }]),
    ];
  };
}

/** The control facts as short sentences (also printed on every report PDF). */
export function useControlWords() {
  const facts = useControlFacts();
  return (c: OwnerControl): string[] => facts(c).map((f) => f.text);
}

/**
 * The control summary: latest close difference, days not closed, supplier balances, low items, compliance issues.
 * "Owner control summary" for the owner; "Control summary" for the manager and the accountant (E8).
 */
export function ControlLine({ query }: { query: UseQueryResult<OwnerControl> }) {
  const { t } = useTranslation();
  const { role } = useWorkspace();
  const facts = useControlFacts();
  if (!query.data) return null;
  return (
    <Card variant="outlined" style={styles.card} testID="report-control">
      <Text variant="small" color="textSecondary">
        {t(role === 'owner' ? 'reports.control.title' : 'reports.control.titleTeam')}
      </Text>
      <View style={styles.items}>
        {facts(query.data).map((f) => (
          <View key={f.text} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: f.warn ? semantic.warning.main : semantic.success.main }]} />
            <Text variant="small" style={styles.flex}>
              {f.text}
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
