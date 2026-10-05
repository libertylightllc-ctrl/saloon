import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useDashboard } from '@/features/dashboard/api';
import { businessMonth } from '@/lib/dates';
import { formatMoney, sum } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { BottomSheet, EmptyState, HeaderBand, KpiCard, KpiGrid, ListRow, QueryState, Screen, SectionHeader, StatusPill, Text } from '@/ui';

import { useMyPay, type Payslip } from './api';
import { SlipBreakdown } from './PayslipSheet';

/** Staff: my commission this month, my advances, bonuses and deductions, and my payslips. */
export function MyPayScreen() {
  const { t } = useTranslation();
  const dates = useDates();
  const { business, branch, employeeId } = useWorkspace();
  const pay = useMyPay(business.id, employeeId);
  const dashboard = useDashboard(branch.id);
  const [open, setOpen] = useState<Payslip | null>(null);
  const month = businessMonth(new Date(), business.timezone);

  return (
    <>
      <Screen
        insetBottom={false}
        refreshing={pay.isRefetching}
        onRefresh={() => {
          void pay.refetch();
          void dashboard.refetch();
        }}
        header={<HeaderBand title={t('myPay.title')} subtitle={t('myPay.subtitle')} />}
      >
        <QueryState query={pay}>
          {(data) => {
            const thisMonth = data.adjustments.filter((a) => a.status === 'posted' && a.business_date.startsWith(month));
            const total = (kind: string) => sum(thisMonth.filter((a) => a.kind === kind).map((a) => a.amount_minor));
            return (
              <View style={styles.body}>
                <KpiGrid>
                  <KpiCard icon="coins" label={t('myPay.commission')} value={formatMoney(dashboard.data?.me?.commission_month_minor ?? 0)} testID="mypay-commission" />
                  <KpiCard icon="wallet" label={t('myPay.advances')} value={formatMoney(total('advance'))} testID="mypay-advances" />
                </KpiGrid>
                {thisMonth.length ? (
                  <View style={styles.block}>
                    <SectionHeader title={t('myPay.thisMonth')} />
                    {thisMonth.map((a) => (
                      <View key={a.id} style={styles.row} testID={`mypay-${a.kind}`}>
                        <Text style={styles.flex}>
                          {t(`payroll.kinds.${a.kind}`)}
                          {a.note ? ` · ${a.note}` : ''}
                        </Text>
                        <Text variant="bodyStrong" tabular>
                          {a.kind === 'bonus' ? '+' : '−'}
                          {formatMoney(a.amount_minor)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <SectionHeader title={t('myPay.payslips')} />
                {data.payslips.length === 0 ? <EmptyState illustration="no-results" message={t('myPay.noPayslips')} /> : null}
                {data.payslips.map((s) => (
                  <ListRow
                    key={s.id}
                    testID={`mypay-slip-${s.payroll_runs?.period}`}
                    title={s.payroll_runs ? dates.day(`${s.payroll_runs.period}-01`, 'MMMM yyyy') : ''}
                    badges={<StatusPill status={s.paid_at ? 'paid' : 'due_soon'} label={t(s.paid_at ? 'payroll.paid' : 'payroll.unpaid')} />}
                    trailing={
                      <Text variant="bodyStrong" tabular>
                        {formatMoney(s.net_minor)}
                      </Text>
                    }
                    chevron
                    onPress={() => setOpen(s)}
                  />
                ))}
              </View>
            );
          }}
        </QueryState>
      </Screen>
      <BottomSheet open={open !== null} onClose={() => setOpen(null)} title={open?.payroll_runs ? dates.day(`${open.payroll_runs.period}-01`, 'MMMM yyyy') : ''}>
        {open ? <SlipBreakdown slip={open} /> : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  block: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
