import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatAt } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Text } from '@/ui';

import type { PayrollChanges } from './api';

/**
 * Since the work-out (owner's app check A1): when the month was worked out; what came in after it (the server refuses
 * approval until it is worked out again); and for an approved month, the commission on sales saved after the work-out
 * that it does not include, so the owner can pay it as a bonus.
 */
export function PayrollChangesNote({ changes, timezone }: { changes: PayrollChanges; timezone: string }) {
  const { t } = useTranslation();
  const dates = useDates();
  const at = formatAt(changes.generated_at, timezone, 'd MMM, HH:mm', dates.language);
  return (
    <View style={styles.box}>
      <Text variant="small" color="textSecondary" testID="payroll-worked-out">
        {t('payroll.workedOutAt', { date: at })}
      </Text>
      {changes.stale ? (
        <Text variant="bodyStrong" testID="payroll-stale">
          {changes.changes > 0 ? t('payroll.changesSince', { count: changes.changes }) : t('payroll.changedSince')}
        </Text>
      ) : null}
      {changes.missed_minor > 0 ? (
        <View style={styles.box} testID="payroll-missed">
          <Text variant="bodyStrong">{t('payroll.missedNote', { date: at, amount: formatMoney(changes.missed_minor) })}</Text>
          {changes.missed.map((m) => (
            <Text key={m.employee_id} variant="small" color="textSecondary">
              {t('payroll.missedLine', { name: m.full_name, amount: formatMoney(m.commission_minor) })}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs },
});
