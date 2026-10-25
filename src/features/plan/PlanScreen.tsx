import { useLocalSearchParams, useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { isUae } from '@/lib/countries';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { semantic, spacing, useTheme } from '@/theme';
import { Button, Card, FormError, HeaderBand, Icon, PillTabs, QueryState, Screen, StatusPill, Text, TextField, useToast, type IconName } from '@/ui';

import { showsBilling, useIsPlatformAdmin, usePlanStatus, useRequestPlan, type PlanStatus } from './api';
import { BranchBill, type PlanMonths } from './BranchBill';
import { payOptions, useCardPrice } from './cardApi';
import { HowToPay } from './HowToPay';
import { CardReturn, PayByCard } from './PayByCard';
import { PilotCodeCard } from './PilotCodeCard';
import { canOfferPlans } from './storePolicy';

/**
 * The line under the plan's name. While billing is off or the salon is free, only a note: "Pilot salon · free until
 * 24 Jan 2027", "Free until …", free for good, or "Free for now". With billing on: paid until, or the free time ended.
 */
function statusLine(p: PlanStatus, t: TFunction, day: (d: string) => string) {
  if (!showsBilling(p)) {
    if (p.access_type === 'comp') return t('plan.access.comp');
    if (p.paid && p.paid_until) return t('plan.paidUntil', { date: day(p.paid_until) });
    if (p.free && p.free_until) return t(p.access_type === 'pilot' ? 'plan.access.pilot' : 'plan.access.free', { date: day(p.free_until) });
    return t('plan.access.now');
  }
  if (p.paid && p.paid_until) return t('plan.paidUntil', { date: day(p.paid_until) });
  if (p.free_until && canOfferPlans) return t('plan.free.ended', { date: day(p.free_until) });
  return t(canOfferPlans ? 'plan.notActiveBody' : 'plan.store.inactiveBody');
}
const INCLUDED: { key: string; icon: IconName }[] = [
  { key: 'queue', icon: 'users' },
  { key: 'sale', icon: 'receipt' },
  { key: 'money', icon: 'banknote' },
  { key: 'people', icon: 'clock' },
  { key: 'compliance', icon: 'shield' },
  { key: 'books', icon: 'chart' },
];

/** Plan & billing: the salon's access, and (billing on, not free) what it costs per branch and how to pay. */
export function PlanScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const dates = useDates();
  const toast = useToast();
  const { business, role } = useWorkspace();
  const plan = usePlanStatus(business.id);
  const request = useRequestPlan(business.id);
  const [months, setMonths] = useState<PlanMonths>(1);
  const [note, setNote] = useState('');
  const owner = can(role, 'requestPlan') && canOfferPlans;
  const uae = isUae(business.country_code);
  const admin = useIsPlatformAdmin().data === true;
  const pay = payOptions(useCardPrice().data, admin);
  const router = useRouter();
  // Back from Creem's checkout: saloqo.com/plan?paid=<the card payment>.
  const { paid } = useLocalSearchParams<{ paid?: string }>();
  const paidId = typeof paid === 'string' && /^[0-9a-f-]{36}$/.test(paid) ? paid : null;

  return (
    <Screen
      refreshing={plan.isRefetching}
      onRefresh={() => void plan.refetch()}
      header={<HeaderBand title={t('plan.title')} subtitle={t('plan.subtitle')} onBack />}
    >
      <QueryState query={plan}>
        {(p) => {
          const billing = showsBilling(p) && canOfferPlans;
          const pill = p.free ? (p.access_type === 'pilot' ? 'plan.free.pilotPill' : 'plan.free.pill') : p.active ? 'plan.active' : 'plan.inactive';
          return (
          <View style={styles.body}>
            <Card variant="outlined" style={styles.card} testID="plan-status">
              <View style={styles.row}>
                <Text variant="h3" style={styles.flex}>
                  {t('plan.name')}
                </Text>
                <StatusPill status={p.active ? 'valid' : 'expired'} label={t(pill)} />
              </View>
              <Text color="textSecondary" testID="plan-status-line">
                {statusLine(p, t, (d) => dates.day(d, 'd MMMM yyyy'))}
              </Text>
              {billing ? <BranchBill plan={p} months={months} onMonths={setMonths} /> : null}
              {billing ? (
              <View style={styles.list}>
                {INCLUDED.map((i) => (
                  <View key={i.key} style={styles.row}>
                    <Icon name={i.icon} size={18} color={semantic.success.main} />
                    <Text style={styles.flex}>
                      {t(`plan.included.${i.key}${uae && (i.key === 'people' || i.key === 'compliance') ? 'Uae' : ''}` as 'plan.included.queue')}
                    </Text>
                  </View>
                ))}
              </View>
              ) : null}
            </Card>

            {owner && paidId ? <CardReturn businessId={business.id} paymentId={paidId} /> : null}
            {owner && billing ? (
              <Card variant="outlined" style={styles.card}>
                <Text variant="h4">{t(p.paid ? 'plan.extendTitle' : 'plan.requestTitle')}</Text>
                {p.requested_at ? (
                  <Text color="primaryText" testID="plan-requested">
                    {t('plan.requested', {
                      months: p.requested_months ?? 1,
                      date: dates.at(p.requested_at, business.timezone, 'd MMM yyyy'),
                    })}
                  </Text>
                ) : null}
              </Card>
            ) : null}
            {/* By card: paid and switched on at once. */}
            {owner && billing ? <PayByCard businessId={business.id} plan={p} months={months} admin={admin} /> : null}
            {/* Neither way to pay is on: ask us (brief 5.3). */}
            {owner && billing && pay.contact ? (
              <Card variant="outlined" style={styles.card} testID="plan-contact">
                <Text color="textSecondary">{t('plan.contactToBuy')}</Text>
                <Button label={t('support.contactTitle')} icon="messageCircle" variant="outline" onPress={() => router.push('/support')} />
              </Card>
            ) : null}
            {/* By bank transfer or a card link, once switched on (brief 5.3): pay first, then tell us (the request below). */}
            {owner && billing && pay.bank ? <HowToPay code={business.code} /> : null}
            {owner && billing && pay.bank ? (
              <Card variant="outlined" style={styles.card}>
                <TextField label={t('plan.note')} placeholder={t('plan.notePlaceholder')} value={note} onChangeText={setNote} testID="plan-note" />
                <FormError error={request.error} />
                <Button
                  label={t(p.paid ? 'plan.extendAction' : 'plan.requestAction')}
                  loading={request.isPending}
                  onPress={() =>
                    request.mutate({ months, note }, { onSuccess: () => { setNote(''); toast(t('plan.requestSent')); } })
                  }
                  testID="plan-request"
                />
              </Card>
            ) : null}
            {/* A pilot code, for an owner whose salon is not a pilot salon or free for good. */}
            {can(role, 'requestPlan') && p.access_type !== 'pilot' && p.access_type !== 'comp' ? <PilotCodeCard businessId={business.id} /> : null}
          </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  list: { gap: spacing.sm },
});
