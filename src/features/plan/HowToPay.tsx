import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';
import { Button, Card, Text } from '@/ui';

import { usePaymentDetails } from './api';

/**
 * Where to pay for the plan, as the platform owner set it (Admin → Payment details): a card payment link and/or bank
 * transfer details, with the salon code as the reference so the payment is matched to the salon.
 */
export function HowToPay({ code }: { code: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const details = usePaymentDetails();
  const d = details.data;
  const bank = d && (d.bank_iban || d.bank_account_name);
  if (!d || (!bank && !d.pay_link_url)) {
    return (
      <Text variant="small" color="textSecondary">
        {t('plan.howToPay')}
      </Text>
    );
  }
  const row = (label: string, value: string | null, testID: string) =>
    value ? (
      <View style={styles.row}>
        <Text color="textSecondary" style={styles.label}>
          {label}
        </Text>
        <Text weight="medium" selectable style={styles.flex} testID={testID}>
          {value}
        </Text>
      </View>
    ) : null;

  return (
    <Card variant="outlined" style={styles.card} testID="plan-how-to-pay">
      <Text variant="h4">{t('plan.pay.title')}</Text>
      {d.pay_link_url ? (
        <Button
          label={t('plan.pay.byCard')}
          icon="creditCard"
          onPress={() => void Linking.openURL(d.pay_link_url!)}
          testID="plan-pay-link"
        />
      ) : null}
      {bank ? (
        <View style={[styles.bank, { backgroundColor: theme.colors.primary50, borderRadius: theme.radius.md }]}>
          <Text variant="bodyStrong">{t('plan.pay.byTransfer')}</Text>
          {row(t('plan.pay.bank'), d.bank_name, 'plan-pay-bank')}
          {row(t('plan.pay.accountName'), d.bank_account_name, 'plan-pay-account')}
          {row(t('plan.pay.iban'), d.bank_iban, 'plan-pay-iban')}
          {row(t('plan.pay.swift'), d.bank_swift, 'plan-pay-swift')}
        </View>
      ) : null}
      {row(t('plan.pay.reference'), code, 'plan-pay-reference')}
      <Text variant="small" color="textSecondary">
        {t('plan.pay.referenceHint')}
      </Text>
      {d.pay_note ? <Text variant="small">{d.pay_note}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  bank: { gap: spacing.sm, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { width: 120 },
  flex: { flex: 1 },
});
