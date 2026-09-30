import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { semantic, spacing, useTheme } from '@/theme';
import { Button, Card, FormError, HeaderBand, Icon, PillTabs, QueryState, Screen, StatusPill, Text, TextField, useToast, type IconName } from '@/ui';

import { usePlanStatus, useRequestPlan } from './api';
import { canOfferPlans } from './storePolicy';

const MONTHS = [1, 3, 6, 12] as const;
const INCLUDED: { key: string; icon: IconName }[] = [
  { key: 'queue', icon: 'users' },
  { key: 'sale', icon: 'receipt' },
  { key: 'money', icon: 'banknote' },
  { key: 'people', icon: 'clock' },
  { key: 'compliance', icon: 'shield' },
  { key: 'books', icon: 'chart' },
];

/** Plan & billing: is the salon's plan on, what it costs, and (owner) asking for it to be switched on. */
export function PlanScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const dates = useDates();
  const toast = useToast();
  const { business, role } = useWorkspace();
  const plan = usePlanStatus(business.id);
  const request = useRequestPlan(business.id);
  const [months, setMonths] = useState<(typeof MONTHS)[number]>(1);
  const [note, setNote] = useState('');
  const owner = can(role, 'requestPlan') && canOfferPlans;

  return (
    <Screen
      refreshing={plan.isRefetching}
      onRefresh={() => void plan.refetch()}
      header={<HeaderBand title={t('plan.title')} subtitle={t('plan.subtitle')} onBack />}
    >
      <QueryState query={plan}>
        {(p) => (
          <View style={styles.body}>
            <Card variant="outlined" style={styles.card} testID="plan-status">
              <View style={styles.row}>
                <Text variant="h3" style={styles.flex}>
                  {t('plan.name')}
                </Text>
                <StatusPill status={p.active ? 'valid' : 'expired'} label={t(p.active ? 'plan.active' : 'plan.inactive')} />
              </View>
              <Text color="textSecondary">
                {p.active && p.paid_until
                  ? t('plan.paidUntil', { date: dates.day(p.paid_until, 'd MMMM yyyy') })
                  : t(canOfferPlans ? 'plan.notActiveBody' : 'plan.store.inactiveBody')}
              </Text>
              {canOfferPlans ? (
                <View style={[styles.price, { backgroundColor: theme.colors.primary50, borderRadius: theme.radius.md }]}>
                  <Text variant="display" tabular testID="plan-price">
                    {formatMoney(p.price_per_branch_minor)}
                  </Text>
                  <Text color="textSecondary">{t('plan.perBranchMonth')}</Text>
                  <Text variant="small" color="textSecondary">
                    {t('plan.forBranches', { count: p.branches, total: formatMoney(p.monthly_minor) })}
                  </Text>
                </View>
              ) : null}
              <View style={styles.list}>
                {INCLUDED.map((i) => (
                  <View key={i.key} style={styles.row}>
                    <Icon name={i.icon} size={18} color={semantic.success.main} />
                    <Text style={styles.flex}>{t(`plan.included.${i.key}` as 'plan.included.queue')}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {owner ? (
              <Card variant="outlined" style={styles.card}>
                <Text variant="h4">{t(p.active ? 'plan.extendTitle' : 'plan.requestTitle')}</Text>
                {p.requested_at ? (
                  <Text color="primaryText" testID="plan-requested">
                    {t('plan.requested', {
                      months: p.requested_months ?? 1,
                      date: dates.at(p.requested_at, business.timezone, 'd MMM yyyy'),
                    })}
                  </Text>
                ) : null}
                <PillTabs<string>
                  items={MONTHS.map((m) => ({ key: String(m), label: t(`plan.monthsOption.${m}` as 'plan.monthsOption.1') }))}
                  value={String(months)}
                  onChange={(v) => setMonths(Number(v) as (typeof MONTHS)[number])}
                  testID="plan-months"
                />
                <Text variant="bodyStrong" testID="plan-total">
                  {t('plan.total', { total: formatMoney(p.monthly_minor * months) })}
                </Text>
                <TextField label={t('plan.note')} placeholder={t('plan.notePlaceholder')} value={note} onChangeText={setNote} testID="plan-note" />
                <FormError error={request.error} />
                <Button
                  label={t(p.active ? 'plan.extendAction' : 'plan.requestAction')}
                  loading={request.isPending}
                  onPress={() =>
                    request.mutate({ months, note }, { onSuccess: () => { setNote(''); toast(t('plan.requestSent')); } })
                  }
                  testID="plan-request"
                />
                <Text variant="small" color="textSecondary">
                  {t('plan.howToPay')}
                </Text>
              </Card>
            ) : null}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  price: { padding: spacing.lg, gap: 2, alignItems: 'flex-start' },
  list: { gap: spacing.sm },
});
