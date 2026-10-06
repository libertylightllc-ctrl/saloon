import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { countryName } from '@/lib/countries';
import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { spacing } from '@/theme';
import { KpiCard, KpiGrid, ListRow, QueryState, SectionHeader, Text } from '@/ui';

import { useOverview } from './api';

const money = (minor: number, currency: string) => (isCurrency(currency) ? formatMoney(minor, currency) : `${currency} ${minor}`);

/** Totals across the service: salons and plans, people, sign-ups, countries, sales and plan income. */
export function OverviewTab() {
  const { t, i18n } = useTranslation();
  const overview = useOverview();
  return (
    <QueryState query={overview}>
      {(o) => (
        <View style={styles.body}>
          <KpiGrid>
            <KpiCard icon="store" label={t('console.overview.salons')} value={String(o.salons)} sub={t('console.overview.salonsSub', { active: o.salons_plan_active, closed: o.salons_closed })} testID="console-salons" />
            <KpiCard icon="creditCard" label={t('console.overview.requests')} value={String(o.plan_requests_open)} />
            <KpiCard icon="users" label={t('console.overview.accounts')} value={String(o.accounts)} sub={t('console.overview.accountsSub', { owners: o.owners, staff: o.staff_logins, none: o.no_salon })} testID="console-accounts" />
            <KpiCard icon="userPlus" label={t('console.overview.signups')} value={String(o.signups_7d)} sub={t('console.overview.signupsSub', { month: o.signups_30d, active: o.signed_in_7d })} />
          </KpiGrid>

          <SectionHeader title={t('console.overview.salesMonth')} />
          {o.sales_month.length === 0 ? <Text color="textSecondary">{t('console.overview.none')}</Text> : null}
          {o.sales_month.map((s) => (
            <ListRow key={s.currency} title={money(s.total_minor, s.currency)} meta={[t('console.overview.salesLine', { count: s.count })]} />
          ))}

          <SectionHeader title={t('console.overview.planIncome')} />
          {o.plan_income.length === 0 ? <Text color="textSecondary">{t('console.overview.none')}</Text> : null}
          {o.plan_income.map((p) => (
            <ListRow key={p.currency} title={money(p.total_minor, p.currency)} />
          ))}

          <SectionHeader title={t('console.overview.countries')} />
          {o.countries.map((c) => (
            <ListRow key={c.code} title={countryName(c.code, i18n.language)} trailing={<Text variant="bodyStrong" tabular>{c.salons}</Text>} />
          ))}
        </View>
      )}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
});
