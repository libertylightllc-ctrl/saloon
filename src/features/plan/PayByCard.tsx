import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { BILLING_LENGTHS, lengthTotal } from '@/config/pricing';
import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { semantic, spacing } from '@/theme';
import { Button, Card, FormError, Icon, Text } from '@/ui';

import { planKey, type PlanStatus } from './api';
import { useCardPayment, useCardPrice, usePayByCard } from './cardApi';

/**
 * Plan & billing → Pay by card: the total in US dollars for the months picked — every branch's price for its people
 * now, with the length's discount (the server works it out the same way) — tax added by Creem where it applies; the
 * button opens Creem's secure checkout. Shown while card payments are live (in test, to platform admins only).
 */
export function PayByCard({ businessId, plan, months, admin }: { businessId: string; plan: PlanStatus; months: number; admin: boolean }) {
  const { t } = useTranslation();
  const price = useCardPrice();
  const pay = usePayByCard(businessId);
  const p = price.data;
  if (!p || p.card_payments === 'off' || (p.card_payments === 'test' && !admin)) return null;
  const currency = isCurrency(p.intl_currency) ? p.intl_currency : 'USD';
  const length = BILLING_LENGTHS.find((l) => l.months === months) ?? BILLING_LENGTHS[0]!;
  const monthly = plan.branches.reduce(
    (sum, b) => sum + p.intl_price_per_branch_minor + Math.max(b.people - p.included_people, 0) * p.intl_extra_person_minor,
    0,
  );
  const total = lengthTotal(monthly, length);
  return (
    <Card variant="outlined" style={styles.card} testID="plan-card">
      <View style={styles.row}>
        <Icon name="creditCard" size={22} />
        <Text variant="h4" style={styles.flex}>
          {t('plan.card.title')}
        </Text>
      </View>
      <Text color="textSecondary">{t('plan.card.body')}</Text>
      <Text variant="bodyStrong" testID="plan-card-total">
        {t('plan.card.total', { total: formatMoney(total, currency) })}
      </Text>
      {p.card_payments === 'test' ? (
        <Text variant="small" style={{ color: semantic.warning.hover }} testID="plan-card-test">
          {t('plan.card.test')}
        </Text>
      ) : null}
      <FormError error={pay.error} />
      <Button
        label={t('plan.card.action', { total: formatMoney(total, currency) })}
        icon="creditCard"
        loading={pay.isPending}
        onPress={() => pay.mutate(months)}
        testID="plan-card-pay"
      />
      <Text variant="small" color="textSecondary">
        {t('plan.card.secure')}
      </Text>
    </Card>
  );
}

/** Back from Creem (?paid=<payment>): "switching on your plan…" until Creem's message is in, then the new end date. */
export function CardReturn({ businessId, paymentId }: { businessId: string; paymentId: string }) {
  const { t } = useTranslation();
  const dates = useDates();
  const client = useQueryClient();
  const payment = useCardPayment(paymentId);
  const status = payment.data?.status;
  const [since] = useState(() => Date.now());
  useEffect(() => {
    if (status === 'paid') void client.invalidateQueries({ queryKey: planKey(businessId) });
  }, [status, client, businessId]);
  if (!payment.data) return null;
  const paid = status === 'paid' && payment.data.paid_until;
  return (
    <Card variant="tinted" style={styles.card} testID="plan-card-return">
      <View style={styles.row}>
        <Icon name={paid ? 'circleCheck' : 'clock'} size={22} color={paid ? semantic.success.main : undefined} />
        <Text variant="bodyStrong" style={styles.flex} testID="plan-card-return-text">
          {paid
            ? t('plan.card.done', { date: dates.day(payment.data.paid_until!, 'd MMMM yyyy') })
            : status === 'pending'
              ? t(payment.dataUpdatedAt - since > 30_000 ? 'plan.card.slow' : 'plan.card.waiting')
              : t('plan.card.check')}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
