import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { semantic, spacing } from '@/theme';
import { Card, Icon, PromoBanner, Text } from '@/ui';

import { usePlanStatus } from './api';
import { canOfferPlans } from './storePolicy';

/**
 * On Home while the salon has no active plan: on the website the owner is shown the way to switch it on; everyone
 * else (and the owner in the phone apps, see storePolicy) is told why nothing new can be saved.
 */
export function PlanBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { business, role } = useWorkspace();
  const plan = usePlanStatus(business.id);
  if (!plan.data || plan.data.active) return null;
  const price = formatMoney(plan.data.monthly_minor, plan.data.currency);

  if (can(role, 'requestPlan') && canOfferPlans) {
    return (
      <View testID="plan-banner">
        <PromoBanner
          title={t(plan.data.requested_at ? 'plan.banner.requestedTitle' : 'plan.banner.title')}
          body={t(plan.data.requested_at ? 'plan.banner.requestedBody' : 'plan.banner.body', { price })}
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
