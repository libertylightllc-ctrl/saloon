import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useInventory } from '@/features/inventory/api';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Card, KpiCard, KpiGrid, ListRow, QueryState, SectionHeader, StatusPill, Text } from '@/ui';

import { useWpsStatus } from './api';

/** WPS: share of salaries proven for the latest paid month. Montaji: registration numbers of products used. */
export function WpsMontajiTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const { business, branch } = useWorkspace();
  const wps = useWpsStatus(business.id, true);
  const items = useInventory(branch.id);
  return (
    <View style={styles.body}>
      <SectionHeader title={t('compliance.wps.title')} />
      <QueryState query={wps}>
        {(w) => {
          const pct = w.required ? Math.round((100 * w.proven) / w.required) : 100;
          return (
            <Card variant="outlined" style={styles.card}>
              {w.period ? (
                <>
                  <KpiGrid>
                    <KpiCard icon="shield" label={dates.day(`${w.period}-01`, 'MMMM yyyy')} value={`${pct}%`} sub={t('compliance.wps.proven', { proven: w.proven, required: w.required })} testID="wps-pct" />
                  </KpiGrid>
                  <StatusPill status={pct >= w.target_pct ? 'valid' : 'due_soon'} label={t('compliance.wps.target', { pct: w.target_pct })} />
                </>
              ) : (
                <Text color="textSecondary">{t('compliance.wps.none')}</Text>
              )}
            </Card>
          );
        }}
      </QueryState>
      <SectionHeader title={t('compliance.montaji.title')} />
      <Text variant="small" color="textSecondary">
        {t('compliance.montaji.hint')}
      </Text>
      <QueryState query={items}>
        {(rows) => (
          <View style={styles.list}>
            {rows
              .filter((i) => i.active && i.kind !== 'tool')
              .map((i) => (
                <ListRow
                  key={i.item_id}
                  testID={`montaji-${i.name}`}
                  title={i.name}
                  meta={[i.montaji_reg_no ? t('compliance.montaji.number', { number: i.montaji_reg_no }) : t('compliance.montaji.missing')]}
                  badges={<StatusPill status={i.montaji_reg_no ? 'valid' : 'low'} label={t(i.montaji_reg_no ? 'compliance.montaji.registered' : 'compliance.montaji.add')} />}
                  chevron
                  onPress={() => router.push({ pathname: '/inventory/form', params: { id: i.item_id } })}
                />
              ))}
          </View>
        )}
      </QueryState>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  card: { gap: spacing.sm },
  list: { gap: spacing.sm },
});
