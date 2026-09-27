import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { businessMonth, type MonthKey } from '@/lib/dates';
import { formatMoney, sum } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { Button, Card, EmptyState, FormError, HeaderBand, ListRow, MonthSwitcher, QueryState, Screen, StatusPill, Text, useToast, type StatusKey } from '@/ui';

import { useApprovePayroll, useGeneratePayroll, usePayrollRun, type Payslip, type RunStatus } from './api';
import { PayslipSheet, SlipRow } from './PayslipSheet';

const RUN_STATUS: Record<RunStatus, StatusKey> = { generated: 'pending_approval', approved: 'due_soon', paid: 'paid' };

/** The month's payroll: generate (a draft), approve (posts it), pay each person, WPS proof. */
export function PayrollScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { business, branch, role } = useWorkspace();
  const thisMonth = businessMonth(new Date(), business.timezone);
  const [month, setMonth] = useState<MonthKey>(thisMonth);
  const run = usePayrollRun(business.id, month);
  const generate = useGeneratePayroll(business.id, branch.id);
  const approve = useApprovePayroll(business.id, branch.id);
  const [open, setOpen] = useState<Payslip | null>(null);
  const owner = can(role, 'runPayroll');

  return (
    <>
      <Screen
        refreshing={run.isRefetching}
        onRefresh={() => void run.refetch()}
        header={
          <HeaderBand
            title={t('payroll.title')}
            onBack
            right={
              owner ? (
                <Button
                  label={t('payroll.adjustments')}
                  icon="sliders"
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/payroll/adjustments', params: { month } })}
                  testID="payroll-adjustments"
                />
              ) : undefined
            }
          >
            <MonthSwitcher value={month} onChange={setMonth} />
          </HeaderBand>
        }
      >
        <QueryState query={run}>
          {(r) => {
            const lines = r?.payroll_lines ?? [];
            const total = (pick: (l: Payslip) => number) => sum(lines.map(pick));
            return (
              <View style={styles.body}>
                <Card variant="outlined" style={styles.card}>
                  <View style={styles.row}>
                    <Text variant="h4" style={styles.flex}>
                      {t('payroll.monthTotal')}
                    </Text>
                    {r ? <StatusPill status={RUN_STATUS[r.status]} label={t(`payroll.status.${r.status}`)} /> : <StatusPill tone="neutral" label={t('payroll.status.none')} />}
                  </View>
                  {r ? (
                    <>
                      <SlipRow label={t('payroll.base')} value={total((l) => l.base_minor)} />
                      <SlipRow label={t('payroll.commission')} value={total((l) => l.commission_minor)} />
                      <SlipRow label={t('payroll.bonus')} value={total((l) => l.bonus_minor)} />
                      <SlipRow label={t('payroll.deductions')} value={-total((l) => l.deductions_minor)} />
                      <SlipRow label={t('payroll.advances')} value={-total((l) => l.advances_minor)} />
                      <SlipRow label={t('payroll.net')} value={total((l) => l.net_minor)} strong testID="payroll-net" />
                    </>
                  ) : (
                    <Text color="textSecondary">{t('payroll.noneYet')}</Text>
                  )}
                  <FormError error={generate.error ?? approve.error} />
                  {owner && (!r || r.status === 'generated') && month <= thisMonth ? (
                    <View style={styles.actions}>
                      <Button
                        label={t(r ? 'payroll.regenerate' : 'payroll.generate')}
                        variant={r ? 'outline' : 'primary'}
                        size="md"
                        loading={generate.isPending}
                        onPress={() => generate.mutate(month, { onSuccess: () => toast(t('payroll.generated')) })}
                        testID="payroll-generate"
                      />
                      {r ? (
                        <Button
                          label={t('payroll.approve')}
                          size="md"
                          disabled={lines.length === 0}
                          loading={approve.isPending}
                          onPress={() => approve.mutate(r.id, { onSuccess: () => toast(t('payroll.approved')) })}
                          testID="payroll-approve"
                        />
                      ) : null}
                    </View>
                  ) : null}
                  {r?.status === 'generated' ? <Text variant="small" color="textSecondary">{t('payroll.draftHint')}</Text> : null}
                </Card>
                {r && lines.length === 0 ? <EmptyState illustration="no-results" message={t('payroll.noLines')} /> : null}
                {lines
                  .slice()
                  .sort((a, b) => (a.employees?.full_name ?? '').localeCompare(b.employees?.full_name ?? ''))
                  .map((l) => (
                    <ListRow
                      key={l.id}
                      testID={`slip-${l.employees?.full_name}`}
                      title={l.employees?.full_name ?? ''}
                      meta={[t('payroll.slipMeta', { base: formatMoney(l.base_minor), commission: formatMoney(l.commission_minor) })]}
                      badges={
                        <View style={styles.badges}>
                          {r?.status !== 'generated' ? (
                            <StatusPill status={l.paid_at ? 'paid' : 'due_soon'} label={t(l.paid_at ? 'payroll.paid' : 'payroll.unpaid')} />
                          ) : null}
                          {l.wps_status !== 'na' ? (
                            <StatusPill status={l.wps_status === 'proven' ? 'valid' : 'pending_approval'} label={t(`payroll.wps.${l.wps_status}`)} />
                          ) : null}
                        </View>
                      }
                      trailing={
                        <Text variant="bodyStrong" tabular>
                          {formatMoney(l.net_minor)}
                        </Text>
                      }
                      chevron
                      onPress={() => setOpen(l)}
                    />
                  ))}
              </View>
            );
          }}
        </QueryState>
      </Screen>
      <PayslipSheet
        slip={open ? (run.data?.payroll_lines.find((l) => l.id === open.id) ?? open) : null}
        status={run.data?.status ?? 'generated'}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
