import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatMoney } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { PillTabs, Text } from '@/ui';

import type { PlanStatus } from './api';

export const PLAN_MONTHS = [1, 6, 12] as const;
export type PlanMonths = (typeof PLAN_MONTHS)[number];

/**
 * The bill, per branch (full update, Phase 6 f): each branch's people and monthly price, every branch together, the
 * billing length picked (1, 6 at 10% off, 12 for the price of 10) and its total. Shown only while billing is on and the
 * salon is not free.
 */
export function BranchBill({ plan, months, onMonths }: { plan: PlanStatus; months: PlanMonths; onMonths: (m: PlanMonths) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const total = plan.lengths.find((l) => l.months === months)?.total_minor ?? plan.monthly_minor * months;
  return (
    <View style={[styles.box, { backgroundColor: theme.colors.primary50, borderRadius: theme.radius.md }]} testID="plan-bill">
      {plan.branches.map((b) => (
        <View key={b.branch_id} style={styles.row} testID={`plan-branch-${b.name}`}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{b.name}</Text>
            <Text variant="small" color="textSecondary">
              {t('plan.branchPeople', { count: b.people })}
            </Text>
          </View>
          <Text tabular>{formatMoney(b.monthly_minor, plan.currency)}</Text>
        </View>
      ))}
      <View style={styles.row}>
        <Text variant="bodyStrong" style={styles.flex}>
          {t('plan.perMonthAll')}
        </Text>
        <Text variant="bodyStrong" tabular testID="plan-price">
          {formatMoney(plan.monthly_minor, plan.currency)}
        </Text>
      </View>
      <Text variant="small" color="textSecondary">
        {t('plan.pricing', {
          base: formatMoney(plan.base_minor, plan.currency),
          included: plan.included_people,
          extra: formatMoney(plan.extra_person_minor, plan.currency),
        })}
      </Text>
      <PillTabs<string>
        items={PLAN_MONTHS.map((m) => ({ key: String(m), label: t(`plan.monthsOption.${m}` as 'plan.monthsOption.1') }))}
        value={String(months)}
        onChange={(v) => onMonths(Number(v) as PlanMonths)}
        testID="plan-months"
      />
      <Text variant="h4" tabular testID="plan-total">
        {t('plan.total', { total: formatMoney(total, plan.currency) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
