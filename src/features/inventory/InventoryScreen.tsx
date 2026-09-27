import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney, sum } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import {
  Button,
  EmptyState,
  HeaderBand,
  KpiCard,
  ListRow,
  PillTabs,
  QueryState,
  Screen,
  SearchBar,
  StatusPill,
  Text,
  Thumb,
  type IconName,
} from '@/ui';

import { useInventory, type ItemKind, type StockItem } from './api';
import { qtyText } from './labels';

type Filter = 'all' | 'low' | ItemKind;
const FILTERS: Filter[] = ['all', 'low', 'consumable', 'retail', 'tool'];
const KIND_ICON: Record<ItemKind, IconName> = { consumable: 'droplets', retail: 'package', tool: 'wrench' };

/** Items, levels and value; filters All / Low stock / Consumables / Retail / Tools. */
export function InventoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { branch, role } = useWorkspace();
  const items = useInventory(branch.id);
  const [filter, setFilter] = useState<Filter>(FILTERS.includes(params.filter as Filter) ? (params.filter as Filter) : 'all');
  const [search, setSearch] = useState('');
  const owner = can(role, 'manageInventory');
  const today = dates.day;

  const matches = (i: StockItem) =>
    (filter === 'all' ? i.active : filter === 'low' ? i.low : i.active && i.kind === filter) &&
    (!search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Screen
      refreshing={items.isRefetching}
      onRefresh={() => void items.refetch()}
      header={
        <HeaderBand
          title={t('inventory.title')}
          subtitle={t('inventory.subtitle')}
          onBack
          right={
            owner ? (
              <Button label={t('inventory.add')} icon="plus" size="sm" variant="secondary" onPress={() => router.push('/inventory/form')} testID="inventory-add" />
            ) : undefined
          }
        >
          <PillTabs<Filter>
            items={FILTERS.map((f) => ({ key: f, label: t(`inventory.filters.${f}`) }))}
            value={filter}
            onChange={setFilter}
            testID="inventory-filter"
          />
        </HeaderBand>
      }
    >
      <QueryState query={items}>
        {(rows) => {
          const active = rows.filter((i) => i.active);
          const shown = rows.filter(matches);
          const value = sum(active.map((i) => i.value_minor ?? 0));
          return (
            <View style={styles.body}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpis}>
                {can(role, 'viewMoney') ? (
                  <KpiCard icon="wallet" label={t('inventory.value')} value={formatMoney(value)} testID="inventory-value" />
                ) : null}
                <KpiCard icon="alert" label={t('inventory.lowCount')} value={String(active.filter((i) => i.low).length)} testID="inventory-low" />
                <KpiCard icon="package" label={t('inventory.activeItems')} value={String(active.length)} />
                <KpiCard icon="rotate" label={t('inventory.movements')} value={String(sum(active.map((i) => i.movements_30d)))} />
              </ScrollView>
              <View style={styles.actions}>
                {can(role, 'countStock') ? (
                  <Button label={t('inventory.count')} icon="clipboard" variant="outline" size="md" onPress={() => router.push('/inventory/count')} testID="inventory-count" />
                ) : null}
                {owner ? (
                  <Button label={t('inventory.opening.title')} icon="boxes" variant="outline" size="md" onPress={() => router.push('/inventory/opening')} testID="inventory-opening" />
                ) : null}
                {can(role, 'addPurchase') ? (
                  <Button label={t('inventory.order')} icon="truck" variant="outline" size="md" onPress={() => router.push('/purchases/new')} testID="inventory-order" />
                ) : null}
              </View>
              <SearchBar value={search} onChangeText={setSearch} placeholder={t('inventory.search')} testID="inventory-search" />
              {shown.length === 0 ? (
                <EmptyState illustration="no-results" message={t(filter === 'low' ? 'inventory.noLow' : 'inventory.empty')} />
              ) : (
                shown.map((i, n) => (
                  <ListRow
                    key={i.item_id}
                    testID={`item-${i.name}`}
                    leading={<Thumb icon={KIND_ICON[i.kind]} index={n} size={44} />}
                    title={i.name}
                    meta={[
                      [t(`inventory.kinds.${i.kind}`), i.location].filter(Boolean).join(' · '),
                      ...(i.kind === 'tool' && i.assigned_to ? [t('inventory.assignedTo', { name: i.assigned_to })] : []),
                      ...(i.kind === 'tool' && i.next_service_date
                        ? [t('inventory.serviceOn', { date: today(i.next_service_date, 'd MMM') })]
                        : []),
                    ]}
                    badges={
                      i.low ? (
                        <StatusPill status={i.qty <= 0 ? 'out_of_stock' : 'low'} />
                      ) : i.condition === 'needs_service' ? (
                        <StatusPill tone="warning" label={t('inventory.conditions.needs_service')} />
                      ) : !i.active ? (
                        <StatusPill status="archived" />
                      ) : undefined
                    }
                    trailing={
                      <View style={styles.trailing}>
                        <Text variant="bodyStrong" tabular testID={`item-${i.name}-qty`}>
                          {qtyText(i.qty, i.unit, t)}
                        </Text>
                        {i.value_minor !== null && i.kind !== 'tool' ? (
                          <Text variant="small" color="textSecondary" tabular>
                            {formatMoney(i.value_minor)}
                          </Text>
                        ) : null}
                      </View>
                    }
                    chevron
                    onPress={() => router.push({ pathname: '/inventory/[id]', params: { id: i.item_id } })}
                  />
                ))
              )}
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  kpis: { gap: spacing.md, paddingVertical: spacing.xs, paddingHorizontal: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  trailing: { alignItems: 'flex-end', gap: 2 },
});
