import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { countryName } from '@/lib/countries';
import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { spacing } from '@/theme';
import {
  Button,
  KpiCard,
  KpiGrid,
  ListRow,
  QueryState,
  SectionHeader,
  StatusPill,
  Text,
} from '@/ui';

import { useOverview, type Overview } from './api';
import { PaymentsSheet, type PaymentPeriod } from './PaymentsSheet';
import type { SalonFilter } from './salonFilter';

const money = (minor: number, currency: string) =>
  isCurrency(currency) ? formatMoney(minor, currency) : `${currency} ${minor}`;

/**
 * Totals across the service: salons and plans, people, sign-ups, countries, sales and plan income. New pilot
 * applications are a highlighted link to Pilot → Applications (owner's fix list A1). Test salons are left out of all
 * of it, and the last line says how many (final brief E1). The salon groups — paid, free, pilot, free for good and
 * ended — add up to the salon total; closed salons are named apart (owner, 2026-11-08).
 */
export function OverviewTab({
  onOpenPilot,
  onOpenSalons,
}: {
  onOpenPilot: () => void;
  onOpenSalons: (filter: SalonFilter) => void;
}) {
  const { t, i18n } = useTranslation();
  const overview = useOverview();
  const [payments, setPayments] = useState<PaymentPeriod | null>(null);
  return (
    <>
      <QueryState query={overview}>
        {(o) => (
          <View style={styles.body}>
            <KpiGrid>
              <KpiCard
                icon="store"
                label={t('console.overview.salons')}
                value={String(o.salons)}
                sub={t('console.overview.salonsSub', {
                  active: o.salons_plan_active,
                  trial: o.salons_trial,
                  pilot: o.salons_pilot,
                  comp: o.salons_comp,
                  ended: o.salons_ended,
                  closed: o.salons_closed,
                })}
                subLines={8}
                testID="console-salons"
              />
              <KpiCard
                icon="sparkles"
                label={t('console.overview.pilot')}
                value={String(o.pilot_places_left)}
                sub={
                  o.pilot_applications_new
                    ? undefined
                    : t('console.overview.newApplications', { count: 0 })
                }
                action={
                  o.pilot_applications_new ? (
                    <Button
                      size="sm"
                      label={t('console.overview.review', { count: o.pilot_applications_new })}
                      onPress={onOpenPilot}
                      testID="console-pilot-review"
                    />
                  ) : undefined
                }
                testID="console-pilot"
              />
              <KpiCard
                icon="creditCard"
                label={t(o.billing_enabled ? 'console.billing.on' : 'console.billing.off')}
                value={String(o.plan_requests_open)}
                sub={t('console.overview.requests')}
              />
              <KpiCard
                icon="users"
                label={t('console.overview.accounts')}
                value={String(o.accounts)}
                sub={[
                  accountSplit(o, t),
                  [
                    t('console.overview.owners', { count: o.owners }),
                    t('console.overview.staffLogins', { count: o.staff_logins }),
                    t('console.overview.noSalon', { count: o.no_salon }),
                  ].join(' · '),
                ].join('\n')}
                subLines={6}
                testID="console-accounts"
              />
              <KpiCard
                icon="userPlus"
                label={t('console.overview.newSalons')}
                value={String(o.new_salons_7d)}
                sub={t('console.overview.newSalonsSub', { count: o.new_salons_30d })}
                testID="console-new-salons"
              />
              <KpiCard
                icon="userCheck"
                label={t('console.overview.signedIn')}
                value={String(o.salons_signed_in_7d)}
                sub={t('console.overview.signedInSub', { count: o.signed_in_7d })}
                testID="console-signed-in"
              />
            </KpiGrid>

            {!o.billing_enabled && o.salons_ended > 0 ? (
              // Ended salons still work while billing is off: say so before anyone switches it on (owner's brief A7).
              <ListRow
                badges={<StatusPill tone="warning" label={t('console.billing.off')} />}
                title={t('console.overview.endedWarning', { count: o.salons_ended })}
                chevron
                onPress={() => onOpenSalons('ended')}
                testID="console-ended-warning"
              />
            ) : null}

            <SectionHeader title={t('console.overview.salesMonth')} />
            {o.sales_month.length === 0 ? (
              <Text color="textSecondary">{t('console.overview.none')}</Text>
            ) : null}
            {o.sales_month.map((s) => (
              <ListRow
                key={s.currency}
                title={money(s.total_minor, s.currency)}
                meta={[t('console.overview.salesLine', { count: s.count })]}
              />
            ))}

            <SectionHeader title={t('console.overview.planIncome')} />
            {(['month', 'all'] as const).map((period) => {
              const totals = period === 'month' ? o.plan_income_month : o.plan_income;
              return (
                <ListRow
                  key={period}
                  title={t(period === 'month' ? 'console.payments.month' : 'console.payments.all')}
                  meta={[
                    totals.length
                      ? totals.map((p) => money(p.total_minor, p.currency)).join(' · ')
                      : t('console.overview.none'),
                  ]}
                  chevron
                  onPress={() => setPayments(period)}
                  testID={`console-plan-income-${period}`}
                />
              );
            })}
            <Text variant="small" color="textSecondary">
              {t('console.overview.planIncomeHint')}
            </Text>

            <SectionHeader title={t('console.overview.countries')} />
            {o.countries.map((c) => (
              <ListRow
                key={c.code}
                title={countryName(c.code, i18n.language)}
                trailing={
                  <Text variant="bodyStrong" tabular>
                    {c.salons}
                  </Text>
                }
                testID={`console-country-${c.code}`}
              />
            ))}
            <Text variant="small" color="textSecondary" testID="console-rule">
              {t('console.overview.rule')}
            </Text>

            {o.salons_test > 0 ? (
              <Text variant="small" color="textSecondary" testID="console-tests-left-out">
                {t('console.overview.testsLeftOut', { count: o.salons_test })}
              </Text>
            ) : null}
          </View>
        )}
      </QueryState>
      <PaymentsSheet period={payments} onPeriod={setPayments} onClose={() => setPayments(null)} />
    </>
  );
}

/** "28 active · 2 switched off · 2 deleted" (owner's brief A3): the same words on the Overview and in Accounts. */
export function accountSplit(
  o: Pick<Overview, 'accounts_active' | 'accounts_off' | 'accounts_deleted'>,
  t: TFunction,
): string {
  return t('console.overview.accountSplit', {
    active: o.accounts_active,
    off: o.accounts_off,
    deleted: o.accounts_deleted,
  });
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
});
