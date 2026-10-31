import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDates } from '@/lib/useDates';
import { semantic, spacing } from '@/theme';
import { Card, Icon, Text } from '@/ui';

import type { PlanStatus } from './api';

/**
 * While the salon's plan request waits (final brief E3): "Request sent, we'll be in touch", what was asked and when.
 * It shows whether billing is on or off, in place of a way to ask again; nothing once the request is paid or ended.
 */
export function RequestWaiting({ plan, timeZone }: { plan: Pick<PlanStatus, 'requested_at' | 'requested_months'>; timeZone: string }) {
  const { t } = useTranslation();
  const dates = useDates();
  if (!plan.requested_at) return null;
  return (
    <Card variant="outlined" style={styles.card} testID="plan-requested">
      <View style={styles.row}>
        <Icon name="circleCheck" size={20} color={semantic.success.main} />
        <Text variant="bodyStrong" style={styles.flex}>
          {t('plan.requestWaiting')}
        </Text>
      </View>
      <Text color="textSecondary">
        {t('plan.requested', { count: plan.requested_months ?? 1, date: dates.at(plan.requested_at, timeZone, 'd MMM yyyy') })}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
