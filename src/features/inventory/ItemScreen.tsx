import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney, normalizeDigits } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import {
  BottomSheet,
  Button,
  Card,
  EmptyState,
  FormError,
  HeaderBand,
  QueryState,
  Screen,
  SectionHeader,
  SegmentTabs,
  StatusPill,
  Text,
  TextField,
  useToast,
} from '@/ui';

import { useAdjustStock, useInventory, useMovements, type StockItem } from './api';
import { qtyText } from './labels';

function Row({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text color="textSecondary" style={styles.flex}>
        {label}
      </Text>
      <Text variant="bodyStrong" tabular testID={testID}>
        {value}
      </Text>
    </View>
  );
}

/** One item: level, value, details, and its movements (who, why); the owner adjusts or edits. */
export function ItemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business, branch, role } = useWorkspace();
  const items = useInventory(branch.id);
  const frontDesk = can(role, 'viewMoney');
  const movements = useMovements(branch.id, id, frontDesk);
  const [adjusting, setAdjusting] = useState(false);
  const item = items.data?.find((i) => i.item_id === id);

  return (
    <>
      <Screen
        refreshing={items.isRefetching}
        onRefresh={() => {
          void items.refetch();
          void movements.refetch();
        }}
        header={<HeaderBand title={item?.name ?? t('inventory.title')} subtitle={item ? t(`inventory.kinds.${item.kind}`) : undefined} onBack />}
      >
        <QueryState query={items}>
          {() =>
            !item ? (
              <EmptyState illustration="no-results" message={t('errors.not_found')} />
            ) : (
              <View style={styles.body}>
                <Card variant="outlined" style={styles.card}>
                  <Row label={t('inventory.onHand')} value={qtyText(item.qty, item.unit, t)} testID="item-qty" />
                  {item.value_minor !== null ? <Row label={t('inventory.value')} value={formatMoney(item.value_minor)} testID="item-value" /> : null}
                  {item.avg_unit_cost_minor !== null ? (
                    <Row label={t('inventory.avgCost')} value={formatMoney(Math.round(item.avg_unit_cost_minor))} />
                  ) : null}
                  {item.kind !== 'tool' ? <Row label={t('inventory.reorderLevel')} value={qtyText(item.reorder_level, item.unit, t)} /> : null}
                  {item.sell_price_minor !== null ? <Row label={t('inventory.sellPrice')} value={formatMoney(item.sell_price_minor)} /> : null}
                  {item.location ? <Row label={t('inventory.location')} value={item.location} /> : null}
                  {item.kind === 'tool' ? (
                    <>
                      <Row label={t('inventory.condition')} value={t(`inventory.conditions.${item.condition ?? 'good'}`)} testID="item-condition" />
                      {item.next_service_date ? <Row label={t('inventory.nextService')} value={dates.day(item.next_service_date, 'd MMM yyyy')} /> : null}
                      {item.assigned_to ? <Row label={t('inventory.assigned')} value={item.assigned_to} /> : null}
                    </>
                  ) : null}
                  {item.low ? <StatusPill status={item.qty <= 0 ? 'out_of_stock' : 'low'} /> : null}
                </Card>
                {can(role, 'manageInventory') ? (
                  <View style={styles.actions}>
                    <Button label={t('inventory.adjust')} icon="rotate" size="md" onPress={() => setAdjusting(true)} testID="item-adjust" />
                    <Button
                      label={t('common.edit')}
                      icon="pencil"
                      variant="outline"
                      size="md"
                      onPress={() => router.push({ pathname: '/inventory/form', params: { id: item.item_id } })}
                      testID="item-edit"
                    />
                  </View>
                ) : null}
                {frontDesk ? (
                  <View style={styles.card}>
                    <SectionHeader title={t('inventory.history')} />
                    <QueryState query={movements} isEmpty={(rows) => rows.length === 0} empty={<Text color="textSecondary">{t('inventory.noMovements')}</Text>}>
                      {(rows) => (
                        <View style={styles.card}>
                          {rows.map((m) => (
                            <View key={m.id} style={styles.movement} testID={`movement-${m.reason}`}>
                              <View style={styles.flex}>
                                <Text variant="bodyStrong">{t(`inventory.reasons.${m.reason}`)}</Text>
                                <Text variant="small" color="textSecondary">
                                  {[dates.at(m.created_at, business.timezone, 'd MMM · HH:mm'), m.members?.display_name, m.note]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </Text>
                              </View>
                              <Text variant="bodyStrong" tabular>
                                {m.qty_delta > 0 ? '+' : ''}
                                {qtyText(m.qty_delta, item.unit, t)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </QueryState>
                  </View>
                ) : null}
              </View>
            )
          }
        </QueryState>
      </Screen>
      <BottomSheet open={adjusting} onClose={() => setAdjusting(false)} title={t('inventory.adjust')}>
        {adjusting && item ? <AdjustForm item={item} onDone={() => setAdjusting(false)} /> : null}
      </BottomSheet>
    </>
  );
}

function AdjustForm({ item, onDone }: { item: StockItem; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const adjust = useAdjustStock(branch.id, business.id);
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [clientRef] = useState(() => Crypto.randomUUID());
  const n = Number(normalizeDigits(qty).replace(',', '.'));
  const valid = qty.trim() !== '' && Number.isFinite(n) && n > 0 && (direction === 'in' || n <= item.qty);
  return (
    <>
      <Text color="textSecondary">{t('inventory.adjustHint', { qty: qtyText(item.qty, item.unit, t) })}</Text>
      <SegmentTabs<'out' | 'in'>
        items={[
          { key: 'out', label: t('inventory.adjustOut') },
          { key: 'in', label: t('inventory.adjustIn') },
        ]}
        value={direction}
        onChange={setDirection}
        testID="adjust-direction"
      />
      <TextField
        label={t('inventory.adjustQty', { unit: t(`units.${item.unit}`) })}
        value={qty}
        onChangeText={setQty}
        keyboardType="decimal-pad"
        error={qty.trim() && !valid ? t('inventory.adjustTooMuch', { qty: qtyText(item.qty, item.unit, t) }) : undefined}
        testID="adjust-qty"
      />
      <TextField label={t('inventory.adjustReason')} value={reason} onChangeText={setReason} maxLength={200} testID="adjust-reason" />
      <FormError error={adjust.error} />
      <Button
        label={t('inventory.adjustSave')}
        disabled={!valid || reason.trim().length < 3}
        loading={adjust.isPending}
        onPress={() =>
          adjust.mutate(
            { item_id: item.item_id, qty_delta: direction === 'out' ? -n : n, reason: reason.trim(), client_ref: clientRef },
            {
              onSuccess: () => {
                toast(t('inventory.adjusted'));
                onDone();
              },
            },
          )
        }
        testID="adjust-save"
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  movement: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
