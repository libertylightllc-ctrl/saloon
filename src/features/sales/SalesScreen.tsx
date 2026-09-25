import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { EmptyState, HeaderBand, ListRow, QueryState, Screen, SectionHeader, StatusPill, Text } from '@/ui';

import { useRecentSales, type Sale } from './api';

export function SalesScreen() {
  const { t } = useTranslation();
  const dates = useDates();
  const router = useRouter();
  const { business, branch } = useWorkspace();
  const query = useRecentSales(branch.id);

  const byDay = (sales: Sale[]) => {
    const groups = new Map<string, Sale[]>();
    for (const s of sales) groups.set(s.business_date, [...(groups.get(s.business_date) ?? []), s]);
    return [...groups.entries()];
  };

  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      header={<HeaderBand title={t('sales.title')} subtitle={t('sales.subtitle')} onBack />}
    >
      <QueryState
        query={query}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState illustration="no-results" message={t('sales.empty')} />}
      >
        {(data) => (
          <View style={styles.body}>
            {byDay(data).map(([day, sales]) => (
              <View key={day} style={styles.group}>
                <SectionHeader title={dates.day(day, 'EEE d MMM')} />
                {sales.map((s) => (
                  <ListRow
                    key={s.id}
                    testID={`sale-row-${s.number}`}
                    title={t('sales.number', { number: s.number })}
                    meta={[
                      [dates.at(new Date(s.created_at), business.timezone, 'HH:mm'), s.customer_name ?? t('queue.guest')].join(' · '),
                    ]}
                    badges={s.status !== 'completed' ? <StatusPill status="reversed" label={t(`sales.status.${s.status}`)} /> : undefined}
                    trailing={
                      <Text variant="bodyStrong" tabular>
                        {formatMoney(s.total_minor)}
                      </Text>
                    }
                    chevron
                    onPress={() => router.push({ pathname: '/sales/[id]', params: { id: s.id } })}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  group: { gap: spacing.sm },
});
