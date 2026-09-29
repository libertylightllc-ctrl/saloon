import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { semantic, spacing } from '@/theme';
import { Card, Icon, PromoBanner, Text } from '@/ui';

import { usePlanStatus } from './api';

/** On Home while the salon has no active plan: the owner is shown the way to switch it on, everyone else why. */
export function PlanBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { business, role } = useWorkspace();
  const plan = usePlanStatus(business.id);
  if (!plan.data || plan.data.active) return null;
  const price = formatMoney(plan.data.price_per_branch_minor);

  if (can(role, 'requestPlan')) {
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
          {t('plan.banner.staffBody')}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
