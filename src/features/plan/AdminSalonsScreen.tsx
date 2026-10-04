import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { countryName } from '@/lib/countries';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import {
  BottomSheet,
  Button,
  EmptyState,
  FormError,
  HeaderBand,
  ListRow,
  MoneyInput,
  PillTabs,
  QueryState,
  Screen,
  StatusPill,
  Text,
  TextField,
  useToast,
} from '@/ui';

import { useAdminPlanAction, useAdminSalons, useIsPlatformAdmin, usePaymentDetails, type AdminSalon } from './api';
import { PaymentDetailsSheet } from './PaymentDetailsSheet';

const MONTHS = [1, 3, 6, 12] as const;

/** For the platform owner only: every salon, who asked for a plan, and recording a payment or ending a plan. */
export function AdminSalonsScreen() {
  const { t, i18n } = useTranslation();
  const dates = useDates();
  const admin = useIsPlatformAdmin();
  const salons = useAdminSalons();
  const [open, setOpen] = useState<AdminSalon | null>(null);
  const [paying, setPaying] = useState(false);
  const payment = usePaymentDetails();

  if (admin.data === false) return <Redirect href="/" />;
  return (
    <>
      <Screen
        refreshing={salons.isRefetching}
        onRefresh={() => void salons.refetch()}
        header={
          <HeaderBand
            title={t('admin.title')}
            subtitle={t('admin.subtitle')}
            onBack
            right={
              <Button label={t('admin.pay.button')} icon="creditCard" size="sm" variant="secondary" onPress={() => setPaying(true)} testID="admin-pay" />
            }
          />
        }
      >
        <QueryState query={salons} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('admin.empty')} />}>
          {(rows) => (
            <View style={styles.list}>
              {rows.map((s) => (
                <ListRow
                  key={s.business_id}
                  testID={`admin-salon-${s.code}`}
                  title={s.name}
                  meta={[
                    [s.owner_name, s.owner_email].filter(Boolean).join(' · '),
                    t('admin.meta', { code: s.code, branches: s.branches, date: dates.at(s.created_at, s.timezone, 'd MMM yyyy') }),
                    countryName(s.country_code, i18n.language),
                    ...(s.requested_at
                      ? [t('admin.requested', { months: s.requested_months ?? 1, note: s.request_note ?? '' }).trim()]
                      : []),
                  ]}
                  badges={
                    <View style={styles.badges}>
                      <StatusPill
                        status={s.active ? 'valid' : 'expired'}
                        label={s.active && s.paid_until ? t('admin.until', { date: dates.day(s.paid_until, 'd MMM yyyy') }) : t('plan.inactive')}
                      />
                      {s.requested_at ? <StatusPill status="pending_approval" label={t('admin.asked')} /> : null}
                    </View>
                  }
                  chevron
                  onPress={() => setOpen(s)}
                />
              ))}
            </View>
          )}
        </QueryState>
      </Screen>
      <PaymentDetailsSheet open={paying} onClose={() => setPaying(false)} current={payment.data} />
      <BottomSheet open={open !== null} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open ? <SalonPlanForm salon={open} onDone={() => setOpen(null)} /> : null}
      </BottomSheet>
    </>
  );
}

function SalonPlanForm({ salon, onDone }: { salon: AdminSalon; onDone: () => void }) {
  // The salon's own price: AED in the UAE, USD elsewhere.
  const price = salon.price_per_branch_minor;
  const currency = salon.plan_currency;
  const { t } = useTranslation();
  const toast = useToast();
  const action = useAdminPlanAction();
  const [months, setMonths] = useState<number>(salon.requested_months ?? 1);
  const [amount, setAmount] = useState<number | null>(price * Math.max(salon.branches, 1) * (salon.requested_months ?? 1));
  const [note, setNote] = useState('');

  return (
    <View style={styles.sheet}>
      <PillTabs<string>
        items={MONTHS.map((m) => ({ key: String(m), label: t(`plan.monthsOption.${m}` as 'plan.monthsOption.1') }))}
        value={String(months)}
        onChange={(v) => {
          setMonths(Number(v));
          setAmount(price * Math.max(salon.branches, 1) * Number(v));
        }}
        testID="admin-months"
      />
      <MoneyInput label={t('admin.amount')} value={amount} onChange={setAmount} currency={currency} testID="admin-amount" />
      <TextField label={t('admin.note')} placeholder={t('admin.notePlaceholder')} value={note} onChangeText={setNote} testID="admin-note" />
      <FormError error={action.error} />
      <Button
        label={t('admin.recordPayment', { total: formatMoney(amount ?? 0, currency) })}
        loading={action.isPending}
        disabled={amount === null}
        onPress={() =>
          action.mutate(
            { business: salon.business_id, action: 'activate', months, amount_minor: amount ?? 0, note },
            { onSuccess: () => { toast(t('admin.activated', { name: salon.name })); onDone(); } },
          )
        }
        testID="admin-activate"
      />
      {salon.active ? (
        <Button
          label={t('admin.endPlan')}
          variant="ghost"
          disabled={note.trim().length < 3}
          onPress={() =>
            action.mutate({ business: salon.business_id, action: 'end', note }, { onSuccess: () => { toast(t('admin.ended', { name: salon.name })); onDone(); } })
          }
          testID="admin-end"
        />
      ) : null}
      <Text variant="small" color="textSecondary">
        {t('admin.hint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  sheet: { gap: spacing.lg },
});
