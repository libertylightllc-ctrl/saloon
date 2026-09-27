import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useLedgerLabels } from '@/features/accounts/labels';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';
import { Card, StatusPill, Text } from '@/ui';

import type { ClosingPreview } from './api';
import { varianceKind } from './count';

export function MoneyLine({ label, value, strong, testID }: { label: string; value: number; strong?: boolean; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text variant={strong ? 'bodyStrong' : 'body'} color={strong ? 'text' : 'textSecondary'} style={styles.flex}>
        {label}
      </Text>
      <Text variant={strong ? 'h4' : 'bodyStrong'} tabular testID={testID}>
        {formatMoney(value)}
      </Text>
    </View>
  );
}

/** "Expected cash · Tue 22 Sep": opening, each kind of cash in and out that day, and the total. */
export function ExpectedCard({ preview }: { preview: ClosingPreview }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dates = useDates();
  const labels = useLedgerLabels();
  return (
    <Card variant="outlined" style={styles.card}>
      <Text variant="h4">{t('closing.expectedOn', { date: dates.day(preview.business_date, 'EEE d MMM') })}</Text>
      <MoneyLine label={t('closing.opening')} value={preview.opening_cash_minor} testID="closing-opening" />
      {preview.lines.map((l) => (
        <MoneyLine
          key={l.kind}
          label={t('accounts.kindCount', { kind: labels.source(l.kind), n: l.entries })}
          value={l.amount_minor}
          testID={`closing-line-${l.kind}`}
        />
      ))}
      {preview.lines.length === 0 ? <Text color="textSecondary">{t('closing.noCashMoves')}</Text> : null}
      <View style={[styles.rule, { backgroundColor: theme.colors.divider }]} />
      <MoneyLine label={t('closing.expected')} value={preview.expected_cash_minor} strong testID="closing-expected" />
    </Card>
  );
}

/** Short by … in error colours, Over by … in warning, Balanced in success. */
export function VarianceChip({ counted, expected }: { counted: number; expected: number }) {
  const { t } = useTranslation();
  const kind = varianceKind(counted, expected);
  const amount = formatMoney(Math.abs(counted - expected));
  return (
    <View testID="closing-variance" style={styles.chip}>
      <StatusPill
        tone={kind === 'short' ? 'error' : kind === 'over' ? 'warning' : 'success'}
        label={t(`closing.variance.${kind}`, { amount })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  chip: { flexDirection: 'row' },
});
