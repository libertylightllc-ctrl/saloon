import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney, sum } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { Card, QueryState, StatusPill, Text } from '@/ui';

import { useAccountTotals } from './api';
import { useLedgerLabels } from './labels';

/** Every account with a balance, debit or credit side, and the check that both sides agree. */
export function TrialBalanceTab() {
  const { t } = useTranslation();
  const theme = useTheme();
  const labels = useLedgerLabels();
  const { business } = useWorkspace();
  const totals = useAccountTotals(business.id, null, null);

  const cell = (text: string, strong = false, testID?: string) => (
    <Text variant={strong ? 'bodyStrong' : 'small'} tabular align="end" style={styles.money} testID={testID}>
      {text}
    </Text>
  );

  return (
    <QueryState query={totals}>
      {(rows) => {
        const used = rows.filter((a) => a.debit_minor !== 0 || a.credit_minor !== 0);
        const side = used.map((a) => {
          const net = a.debit_minor - a.credit_minor;
          return { a, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
        });
        const debits = sum(side.map((s) => s.debit));
        const credits = sum(side.map((s) => s.credit));
        const balanced = debits === credits;
        return (
          <View style={styles.body}>
            <View style={styles.head}>
              <StatusPill tone={balanced ? 'success' : 'error'} label={t(balanced ? 'accounts.balancedYes' : 'accounts.balancedNo')} />
              <Text variant="small" color="textSecondary" style={styles.flex}>
                {t('accounts.balanceHint')}
              </Text>
            </View>
            <Card variant="outlined" style={styles.card}>
              <View style={styles.row}>
                <Text variant="small" color="textSecondary" style={styles.flex}>
                  {t('accounts.account')}
                </Text>
                {cell(t('accounts.debit'))}
                {cell(t('accounts.credit'))}
              </View>
              {side.map(({ a, debit, credit }) => (
                <View key={a.account_id} style={styles.row} testID={`tb-${a.system_key ?? a.code}`}>
                  <Text variant="small" style={styles.flex} numberOfLines={3}>
                    {`${a.code} · ${labels.account(a)}`}
                  </Text>
                  {cell(debit ? formatMoney(debit) : '')}
                  {cell(credit ? formatMoney(credit) : '')}
                </View>
              ))}
              <View style={[styles.rule, { backgroundColor: theme.colors.divider }]} />
              <View style={styles.row}>
                <Text variant="bodyStrong" style={styles.flex}>
                  {t('accounts.total')}
                </Text>
                {cell(formatMoney(debits), true, 'tb-debits')}
                {cell(formatMoney(credits), true, 'tb-credits')}
              </View>
            </Card>
          </View>
        );
      }}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  money: { width: 100 },
  rule: { height: StyleSheet.hairlineWidth },
});
