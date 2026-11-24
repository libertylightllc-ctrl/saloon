import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { BottomSheet, Button, EmptyState, FormError, ListRow, PillTabs, QueryState, StatusPill, Text, TextField, useToast } from '@/ui';

import { useMarkPayment, usePayments, type PlanPayment } from './api';

const ZONE = 'Asia/Dubai';
export type PaymentPeriod = 'month' | 'all';

const money = (minor: number, currency: string | null) =>
  currency && isCurrency(currency) ? formatMoney(minor, currency) : `${currency ?? ''} ${minor}`.trim();

/** The payments of a period: this month (Dubai's calendar, as the Overview's) or all time. */
export function inPeriod(p: Pick<PlanPayment, 'created_at'>, period: PaymentPeriod, now = new Date()): boolean {
  if (period === 'all') return true;
  const month = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit' }).format(d);
  return month(new Date(p.created_at)) === month(now);
}

/**
 * The plan payments behind the Overview's totals (owner's brief A4), this month or all time. Every payment is listed;
 * those on test salons or marked Test or Void say so and are not counted. A platform owner marks a payment Test or
 * Void, or counts it again, with a reason; the payment itself never changes.
 */
export function PaymentsSheet({ period, onPeriod, onClose }: { period: PaymentPeriod | null; onPeriod: (p: PaymentPeriod) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const dates = useDates();
  const toast = useToast();
  const payments = usePayments(period !== null);
  const mark = useMarkPayment();
  const [picked, setPicked] = useState<PlanPayment | null>(null);
  const [reason, setReason] = useState('');
  const choose = (p: PlanPayment | null) => {
    setPicked(p);
    setReason('');
    mark.reset();
  };
  const run = (to: 'test' | 'void' | null) =>
    picked &&
    mark.mutate(
      { id: picked.id, mark: to, reason },
      {
        onSuccess: () => {
          toast(t(to ? `console.payments.marked.${to}` : 'console.payments.counted', { salon: picked.salon }));
          choose(null);
        },
      },
    );

  return (
    <BottomSheet open={period !== null} onClose={onClose} title={t('console.payments.title')}>
      <View style={styles.body}>
        <PillTabs<PaymentPeriod>
          items={[
            { key: 'month', label: t('console.payments.month') },
            { key: 'all', label: t('console.payments.all') },
          ]}
          value={period ?? 'month'}
          onChange={(p) => {
            choose(null);
            onPeriod(p);
          }}
          testID="console-payments-period"
        />
        {picked ? (
          <View style={styles.form} testID="console-payment-form">
            <Text variant="bodyStrong">{[picked.salon, money(picked.amount_minor, picked.currency), dates.at(picked.created_at, ZONE, 'd MMM yyyy')].join(' · ')}</Text>
            <TextField label={t('console.payments.reason')} value={reason} onChangeText={setReason} testID="console-payment-reason" />
            <FormError error={mark.error} />
            <View style={styles.actions}>
              {picked.mark !== 'test' ? (
                <Button label={t('console.payments.markTest')} size="md" variant="secondary" disabled={reason.trim().length < 3} loading={mark.isPending} onPress={() => run('test')} testID="console-payment-test" />
              ) : null}
              {picked.mark !== 'void' ? (
                <Button label={t('console.payments.markVoid')} size="md" variant="danger" disabled={reason.trim().length < 3} loading={mark.isPending} onPress={() => run('void')} testID="console-payment-void" />
              ) : null}
              {picked.mark ? (
                <Button label={t('console.payments.countAgain')} size="md" variant="secondary" disabled={reason.trim().length < 3} loading={mark.isPending} onPress={() => run(null)} testID="console-payment-count" />
              ) : null}
              <Button label={t('common.cancel')} size="md" variant="ghost" onPress={() => choose(null)} />
            </View>
          </View>
        ) : null}
        <QueryState query={payments}>
          {(rows) => {
            const shown = rows.filter((p) => inPeriod(p, period ?? 'month'));
            if (shown.length === 0) return <EmptyState illustration="no-results" message={t('console.payments.none')} />;
            return (
              <View style={styles.list}>
                {shown.map((p) => (
                  <ListRow
                    key={p.id}
                    testID={`console-payment-${p.code}-${p.amount_minor}`}
                    title={`${p.salon} (${p.code})`}
                    meta={[
                      [p.months ? t('console.plans.months', { count: p.months }) : null, money(p.amount_minor, p.currency), dates.at(p.created_at, ZONE, 'd MMM yyyy')]
                        .filter(Boolean)
                        .join(' · '),
                      ...(p.note ? [p.note] : []),
                      ...(p.mark && p.mark_reason
                        ? [t('console.payments.markLine', { reason: p.mark_reason, name: p.marked_by_name ?? 'Saloqo', date: dates.at(p.marked_at ?? p.created_at, ZONE, 'd MMM yyyy') })]
                        : []),
                    ]}
                    badges={
                      <View style={styles.badges}>
                        {p.mark ? <StatusPill status="cancelled" label={t(`console.payments.mark.${p.mark}`)} /> : null}
                        {p.test_salon ? <StatusPill tone="info" label={t('console.payments.testSalon')} /> : null}
                        {p.closed ? <StatusPill tone="neutral" label={t('console.salons.closed')} /> : null}
                        {!p.counted ? <StatusPill tone="neutral" label={t('console.payments.notCounted')} /> : null}
                      </View>
                    }
                    chevron
                    onPress={() => choose(p)}
                  />
                ))}
              </View>
            );
          }}
        </QueryState>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  form: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
