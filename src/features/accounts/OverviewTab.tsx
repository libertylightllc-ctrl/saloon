import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { businessDate, businessMonth, shiftBusinessDate, shiftMonth, type MonthKey } from '@/lib/dates';
import { formatMoney, sum } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { Card, MonthSwitcher, QueryState, SectionHeader, StatusPill, Text } from '@/ui';

import { balanceOf, useAccountTotals, useCashBreakdown, type AccountTotal } from './api';
import { useLedgerLabels } from './labels';

function Row({
  label,
  value,
  strong,
  indent,
  testID,
}: {
  label: string;
  value: number;
  strong?: boolean;
  indent?: boolean;
  testID?: string;
}) {
  return (
    <View style={[styles.row, indent && styles.indent]}>
      <Text variant={strong ? 'bodyStrong' : 'body'} color={strong ? 'text' : 'textSecondary'} style={styles.flex}>
        {label}
      </Text>
      <Text variant={strong ? 'h4' : 'bodyStrong'} tabular testID={testID}>
        {formatMoney(value)}
      </Text>
    </View>
  );
}

const total = (rows: AccountTotal[], pick: (a: AccountTotal) => boolean) => sum(rows.filter(pick).map(balanceOf));

/** The calculations: how today's expected cash is made up, and this month's result. */
export function OverviewTab() {
  const { t } = useTranslation();
  const theme = useTheme();
  const labels = useLedgerLabels();
  const { business, branch } = useWorkspace();
  const rule = <View style={[styles.rule, { backgroundColor: theme.colors.divider }]} />;
  const today = businessDate(new Date(), business.timezone);
  const [month, setMonth] = useState<MonthKey>(businessMonth(new Date(), business.timezone));
  const monthEnd = shiftBusinessDate(`${shiftMonth(month, 1)}-01`, -1);
  const cash = useCashBreakdown(branch.id, today);
  const period = useAccountTotals(business.id, `${month}-01`, monthEnd);

  return (
    <View style={styles.body}>
      <SectionHeader title={t('accounts.cashToday')} />
      <Card variant="outlined" style={styles.card}>
        <QueryState query={cash}>
          {(parts) => {
            const forward = parts.find((p) => p.kind === 'brought_forward');
            const moves = parts.filter((p) => p.kind !== 'brought_forward');
            return (
              <>
                <Row label={t('accounts.broughtForward')} value={forward?.amount_minor ?? 0} testID="cash-forward" />
                {moves.map((p) => (
                  <Row key={p.kind} label={t('accounts.kindCount', { kind: labels.source(p.kind), n: p.entries })} value={p.amount_minor} />
                ))}
                {moves.length === 0 ? <Text color="textSecondary">{t('accounts.noCashToday')}</Text> : null}
                {rule}
                <Row label={t('accounts.expectedCash')} value={sum(parts.map((p) => p.amount_minor))} strong testID="cash-expected" />
                <Text variant="small" color="textSecondary">
                  {t('accounts.cashNote')}
                </Text>
              </>
            );
          }}
        </QueryState>
      </Card>

      <SectionHeader title={t('accounts.month')} />
      <MonthSwitcher value={month} onChange={setMonth} />
      <Card variant="outlined" style={styles.card}>
        <QueryState query={period}>
          {(rows) => {
            const revenue = total(rows, (a) => a.type === 'income');
            const costs = total(rows, (a) => a.type === 'expense');
            const debits = sum(rows.map((a) => a.debit_minor));
            const credits = sum(rows.map((a) => a.credit_minor));
            const key = (k: string) => (a: AccountTotal) => a.system_key === k;
            return (
              <>
                <Row label={t('accounts.revenue')} value={revenue} testID="month-revenue" />
                {rows
                  .filter((a) => a.type === 'income' && balanceOf(a) !== 0)
                  .map((a) => (
                    <Row key={a.account_id} label={labels.account(a)} indent value={balanceOf(a)} />
                  ))}
                <Row label={t('accounts.costs')} value={costs} testID="month-costs" />
                {rows
                  .filter((a) => a.type === 'expense' && balanceOf(a) !== 0)
                  .map((a) => (
                    <Row key={a.account_id} label={labels.account(a)} indent value={balanceOf(a)} />
                  ))}
                {rule}
                <Row label={t('accounts.result')} value={revenue - costs} strong testID="month-result" />
                <Row label={t('accounts.vatCollected')} value={total(rows, key('vat_payable'))} testID="month-vat" />
                <Row label={t('accounts.tipsCollected')} value={total(rows, key('tips_payable'))} />
                <View style={styles.balanced}>
                  <StatusPill
                    tone={debits === credits ? 'success' : 'error'}
                    label={t(debits === credits ? 'accounts.balancedYes' : 'accounts.balancedNo')}
                  />
                </View>
              </>
            );
          }}
        </QueryState>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  indent: { paddingStart: spacing.lg },
  rule: { height: StyleSheet.hairlineWidth },
  balanced: { flexDirection: 'row' },
});
