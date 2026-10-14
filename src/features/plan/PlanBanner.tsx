import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { semantic, spacing, useTheme } from '@/theme';
import { Button, Card, Icon, PromoBanner, Text } from '@/ui';

import { trialDaysLeft, usePlanStatus } from './api';
import { canOfferPlans } from './storePolicy';

/**
 * On Home while the salon has no active plan: on the website the owner is shown the way to switch it on; everyone
 * else (and the owner in the phone apps, see storePolicy) is told why nothing new can be saved. During the free trial
 * the owner sees how long is left (staff are not bothered with it).
 */
export function PlanBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { business, role } = useWorkspace();
  const theme = useTheme();
  const dates = useDates();
  const plan = usePlanStatus(business.id);
  if (!plan.data) return null;
  const p = plan.data;
  if (p.active) {
    if (!p.trial || !p.paid_until || !can(role, 'requestPlan')) return null;
    const left = trialDaysLeft(p);
    return (
      <Card variant="outlined" style={styles.card} testID="plan-trial">
        <Icon name="sparkles" size={20} color={theme.colors.primary500} />
        <View style={styles.flex}>
          <Text variant="h4">{left === 0 ? t('plan.trial.lastDay') : t('plan.trial.bannerTitle', { count: left })}</Text>
          <Text variant="small" color="textSecondary">
            {t(canOfferPlans ? 'plan.trial.bannerBody' : 'plan.trial.bannerBodyStore', { date: dates.day(p.paid_until, 'd MMM') })}
          </Text>
        </View>
        {canOfferPlans ? (
          <Button label={t('plan.banner.action')} size="sm" variant="outline" onPress={() => router.push('/plan')} testID="plan-trial-open" />
        ) : null}
      </Card>
    );
  }
  const price = formatMoney(p.monthly_minor, p.currency);

  if (can(role, 'requestPlan') && canOfferPlans) {
    return (
      <View testID="plan-banner">
        <PromoBanner
          title={t(p.requested_at ? 'plan.banner.requestedTitle' : p.trial ? 'plan.banner.trialEndedTitle' : 'plan.banner.title')}
          body={t(p.requested_at ? 'plan.banner.requestedBody' : 'plan.banner.body', { price })}
          actionLabel={t('plan.banner.action')}
          illustration="promo-setup"
          onAction={() => router.push('/plan')}
        />
      </View>
    );
  }
  return (
    <Card variant="outlined" style={styles.card} testID="plan-banner">
      <Icon name="lock" size={20} color={semantic.warning.main} />
      <View style={styles.flex}>
        <Text variant="h4">{t('plan.banner.staffTitle')}</Text>
        <Text variant="small" color="textSecondary">
          {t(can(role, 'requestPlan') ? 'plan.store.inactiveBody' : 'plan.banner.staffBody')}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
