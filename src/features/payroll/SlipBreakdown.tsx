import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatMoney } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { Text } from '@/ui';

import type { Payslip } from './api';

export function SlipRow({ label, value, strong, testID }: { label: string; value: number; strong?: boolean; testID?: string }) {
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

/** base + commission + bonus − deductions − advances = net; every line shown, zero or not. */
export function SlipBreakdown({ slip }: { slip: Payslip }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.block}>
      <SlipRow label={t('payroll.base')} value={slip.base_minor} testID="slip-base" />
      <SlipRow label={t('payroll.commission')} value={slip.commission_minor} testID="slip-commission" />
      <SlipRow label={t('payroll.bonus')} value={slip.bonus_minor} testID="slip-bonus" />
      <SlipRow label={t('payroll.deductions')} value={-slip.deductions_minor} testID="slip-deductions" />
      <SlipRow label={t('payroll.advances')} value={-slip.advances_minor} testID="slip-advances" />
      <View style={[styles.rule, { backgroundColor: theme.colors.divider }]} />
      <SlipRow label={t('payroll.net')} value={slip.net_minor} strong testID="slip-net" />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
});
