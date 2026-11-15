import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ROLE_TITLES, type RoleTitle } from '@/features/staff/api';
import { useRoleTitle } from '@/features/staff/labels';
import { sharePdf } from '@/lib/exportFile';
import { isLanguage, isRtlLanguage } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';
import { Button, FormError, QueryState, Text } from '@/ui';

import { usePayslipDetails, type Payslip, type PayslipDetails } from './api';
import { SlipBreakdown } from './SlipBreakdown';
import { payslipHtml } from './payslipPrint';

/**
 * The whole payslip (C2): the salon, the person (name, staff ID, job), the month, days employed, days worked and late
 * days, the pay, tips kept that month, "To pay" or "Paid on …", and Download PDF. The owner, the accountant and the
 * person themselves see it.
 */
export function PayslipFull({ slip }: { slip: Payslip }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const dates = useDates();
  const roleTitle = useRoleTitle();
  const details = usePayslipDetails(slip.id);

  const facts = (d: PayslipDetails): [string, string, string][] => [
    [t('payroll.slip.name'), d.full_name, 'slip-name'],
    ...(d.employee_code ? [[t('payroll.slip.staffId'), d.employee_code, 'slip-staff-id'] as [string, string, string]] : []),
    [
      t('payroll.slip.job'),
      (ROLE_TITLES as readonly string[]).includes(d.role_title) ? roleTitle(d.role_title as RoleTitle) : d.role_title,
      'slip-job',
    ],
    [t('payroll.slip.month'), dates.day(`${d.period}-01`, 'MMMM yyyy'), 'slip-month'],
    ...(d.days_employed !== null && d.days_in_month !== null
      ? [[t('payroll.slip.daysEmployed'), t('payroll.slip.daysOf', { days: d.days_employed, total: d.days_in_month }), 'slip-days'] as [string, string, string]]
      : []),
    [t('payroll.slip.attendance'), t('payroll.slip.attendanceValue', { worked: d.days_worked, late: d.late_days }), 'slip-attendance'],
    [t('payroll.slip.status'), status(d), 'slip-status'],
  ];
  const status = (d: PayslipDetails) =>
    d.paid_on
      ? t('payroll.slip.paidOn', {
          date: dates.day(d.paid_on, 'd MMM yyyy'),
          method: d.paid_method ? t(`expenses.methods.${d.paid_method}`) : t('payroll.nothingToPay'),
        })
      : t(d.status === 'generated' ? 'payroll.slip.notApproved' : 'payroll.slip.toPay');

  const pdf = useMutation({
    mutationFn: (d: PayslipDetails) =>
      sharePdf(
        payslipHtml(slip, d, {
          rtl: isLanguage(i18n.language) && isRtlLanguage(i18n.language),
          ink: theme.colors.text,
          muted: theme.colors.textSecondary,
          line: theme.colors.divider,
          title: t('payroll.slip.title'),
          facts: facts(d).map(([label, value]) => [label, value]),
          labels: {
            base: t('payroll.base'),
            commission: t('payroll.commission'),
            bonus: t('payroll.bonus'),
            deductions: t('payroll.deductions'),
            advances: t('payroll.advances'),
            net: t('payroll.net'),
          },
          tips: t('payroll.slip.tips'),
          tipsNote: t('payroll.slip.tipsNote'),
        }),
        `${t('payroll.slip.title')} ${d.full_name} ${d.period}`,
      ),
  });

  return (
    <QueryState query={details}>
      {(d) => (
        <View style={styles.block}>
          <Text variant="bodyStrong">{d.business_name}</Text>
          <View style={styles.facts}>
            {facts(d).map(([label, value, testID]) => (
              <View key={testID} style={styles.fact}>
                <Text variant="small" color="textSecondary" style={styles.label}>
                  {label}
                </Text>
                <Text variant="small" style={styles.flex} testID={testID}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
          <SlipBreakdown slip={slip} />
          <View style={styles.fact}>
            <Text style={styles.flex}>{t('payroll.slip.tips')}</Text>
            <Text variant="bodyStrong" tabular testID="slip-tips">
              {formatMoney(d.tips_minor)}
            </Text>
          </View>
          <Text variant="small" color="textSecondary">
            {t('payroll.slip.tipsNote')}
          </Text>
          <Button
            label={t('payroll.slip.download')}
            icon="download"
            variant="outline"
            size="md"
            loading={pdf.isPending}
            onPress={() => pdf.mutate(d)}
            testID="slip-pdf"
          />
          <FormError error={pdf.error} />
        </View>
      )}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  facts: { gap: spacing.xs },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { width: 110 },
  flex: { flex: 1 },
});
