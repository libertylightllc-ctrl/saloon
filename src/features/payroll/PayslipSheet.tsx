import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { PhotoButtons } from '@/features/moneyout/ReceiptPhoto';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing, useTheme } from '@/theme';
import { BottomSheet, Button, FormError, StatusPill, Text, useToast } from '@/ui';

import { useAttachWps, usePayLine, type Payslip, type RunStatus } from './api';

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

/** base + commission + bonus − deductions − advances = net. */
export function SlipBreakdown({ slip }: { slip: Payslip }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.block}>
      <SlipRow label={t('payroll.base')} value={slip.base_minor} />
      <SlipRow label={t('payroll.commission')} value={slip.commission_minor} testID="slip-commission" />
      {slip.bonus_minor ? <SlipRow label={t('payroll.bonus')} value={slip.bonus_minor} /> : null}
      {slip.deductions_minor ? <SlipRow label={t('payroll.deductions')} value={-slip.deductions_minor} /> : null}
      {slip.advances_minor ? <SlipRow label={t('payroll.advances')} value={-slip.advances_minor} testID="slip-advances" /> : null}
      <View style={[styles.rule, { backgroundColor: theme.colors.divider }]} />
      <SlipRow label={t('payroll.net')} value={slip.net_minor} strong testID="slip-net" />
    </View>
  );
}

/** One payslip: the breakdown, and for the owner Pay (cash / bank) and the WPS transfer proof. */
export function PayslipSheet({ slip, status, onClose }: { slip: Payslip | null; status: RunStatus; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch, role } = useWorkspace();
  const pay = usePayLine(business.id, branch.id);
  const wps = useAttachWps(business.id, branch.id);
  const owner = can(role, 'runPayroll');
  return (
    <BottomSheet open={slip !== null} onClose={onClose} title={slip?.employees?.full_name ?? ''}>
      {slip ? (
        <>
          <SlipBreakdown slip={slip} />
          {slip.paid_at ? (
            <StatusPill status="paid" label={slip.paid_method ? t('payroll.paidBy', { method: t(`expenses.methods.${slip.paid_method}`) }) : t('payroll.nothingToPay')} />
          ) : null}
          {owner && status === 'approved' && !slip.paid_at ? (
            <>
              <FormError error={pay.error} />
              <View style={styles.actions}>
                {(['cash', 'bank'] as const).map((method) => (
                  <Button
                    key={method}
                    label={t(`payroll.payBy.${method}`, { amount: formatMoney(slip.net_minor) })}
                    variant={method === 'bank' ? 'primary' : 'outline'}
                    size="md"
                    loading={pay.isPending}
                    onPress={() =>
                      pay.mutate(
                        { line_id: slip.id, method },
                        {
                          onSuccess: () => {
                            toast(t('payroll.paidToast', { name: slip.employees?.full_name ?? '' }));
                            onClose();
                          },
                        },
                      )
                    }
                    testID={`slip-pay-${method}`}
                  />
                ))}
              </View>
            </>
          ) : null}
          {slip.wps_status !== 'na' ? (
            <View style={styles.block}>
              <StatusPill status={slip.wps_status === 'proven' ? 'valid' : 'due_soon'} label={t(`payroll.wps.${slip.wps_status}`)} />
              {owner && slip.paid_at && slip.wps_status === 'required' ? (
                <>
                  <Text color="textSecondary">{t('payroll.wpsHint')}</Text>
                  <PhotoButtons
                    loading={wps.isPending}
                    onPicked={(photo) =>
                      wps.mutate({ line_id: slip.id, photo }, { onSuccess: () => toast(t('payroll.wpsAdded')) })
                    }
                  />
                  <FormError error={wps.error} />
                </>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
