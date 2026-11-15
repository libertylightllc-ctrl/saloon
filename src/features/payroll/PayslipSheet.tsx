import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { PhotoButtons } from '@/features/moneyout/ReceiptPhoto';
import { businessDate, shiftBusinessDate, type BusinessDate, type MonthKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { BottomSheet, Button, DateStrip, FormError, StatusPill, Text, useToast } from '@/ui';

import { useAttachWps, usePayLine, type Payslip, type RunStatus } from './api';
import { PayslipFull } from './PayslipFull';

/**
 * One payslip: the whole slip (PayslipFull), and for the owner Pay (cash today, or bank on the day it was paid) and the
 * WPS transfer proof.
 */
export function PayslipSheet({
  slip,
  period,
  status,
  onClose,
}: {
  slip: Payslip | null;
  period: MonthKey;
  status: RunStatus;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch, role } = useWorkspace();
  const pay = usePayLine(business.id, branch.id);
  const wps = useAttachWps(business.id, branch.id);
  const owner = can(role, 'runPayroll');
  const today = businessDate(new Date(), business.timezone);
  const [paidOn, setPaidOn] = useState<BusinessDate>(today);
  // Bank transfers may have gone out on an earlier day: from the month's first day (at most 30 days back) to today.
  const first = `${period}-01` > shiftBusinessDate(today, -30) ? `${period}-01` : shiftBusinessDate(today, -30);
  const days: BusinessDate[] = [];
  for (let d = first; d <= today; d = shiftBusinessDate(d, 1)) days.push(d);
  return (
    <BottomSheet open={slip !== null} onClose={onClose} title={slip?.employees?.full_name ?? ''}>
      {slip ? (
        <>
          <PayslipFull slip={slip} />
          {owner && status === 'approved' && !slip.paid_at ? (
            <>
              {days.length > 1 ? (
                <View style={styles.block}>
                  <Text variant="bodyStrong">{t('payroll.slip.paidOnPick')}</Text>
                  <DateStrip dates={days} value={days.includes(paidOn) ? paidOn : today} onChange={setPaidOn} />
                  <Text variant="small" color="textSecondary">
                    {t('payroll.slip.cashToday')}
                  </Text>
                </View>
              ) : null}
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
                        { line_id: slip.id, method, ...(method === 'bank' && paidOn !== today ? { paid_on: paidOn } : {}) },
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
