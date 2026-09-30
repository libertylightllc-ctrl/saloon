import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { InventoryItem } from '@/features/catalog/api';
import { formatMoney } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, Card, Chip, IconButton, MoneyInput, SwitchRow, Text, TextField } from '@/ui';

export interface LineDraft {
  key: string;
  item_id?: string;
  description: string;
  unit?: string;
  qty: string;
  /** What was paid for the whole line (100 ml → AED 45.00), as on the supplier's invoice. */
  amount_minor: number | null;
  update_stock: boolean;
}

export const lineTotal = (l: LineDraft) => l.amount_minor ?? 0;
export const lineValid = (l: LineDraft) => l.description.trim().length > 0 && Number(l.qty) > 0 && l.amount_minor !== null;

/** The cost of one unit (one ml, one piece), shown so the owner can check it: may be a fraction of a fil. */
export const unitCost = (l: LineDraft): number | null => (Number(l.qty) > 0 && l.amount_minor !== null ? l.amount_minor / Number(l.qty) : null);

/** What was bought: stock items (added to stock at their cost) or anything else ("Delivery", "Towels"). */
export function BillLines({ items, value, onChange }: { items: InventoryItem[]; value: LineDraft[]; onChange: (lines: LineDraft[]) => void }) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  const update = (key: string, patch: Partial<LineDraft>) => onChange(value.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <View style={styles.box}>
      {value.map((l, i) => (
        <Card key={l.key} variant="outlined" style={styles.card} padding={spacing.md}>
          <View style={styles.row}>
            {l.item_id ? (
              <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                {l.description}
              </Text>
            ) : (
              <View style={styles.flex}>
                <TextField
                  label={t('purchases.lineDescription')}
                  value={l.description}
                  onChangeText={(description) => update(l.key, { description })}
                  maxLength={80}
                  testID={`bill-line-desc-${i}`}
                />
              </View>
            )}
            <IconButton icon="x" variant="plain" accessibilityLabel={t('purchases.removeLine')} onPress={() => onChange(value.filter((x) => x.key !== l.key))} />
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                label={l.unit ? t('purchases.qtyUnit', { unit: t(`units.${l.unit as 'pcs'}`) }) : t('purchases.qty')}
                value={l.qty}
                onChangeText={(qty) => update(l.key, { qty: qty.replace(/[^0-9.]/g, '') })}
                keyboardType="decimal-pad"
                testID={`bill-line-qty-${i}`}
              />
            </View>
            <View style={styles.flex}>
              <MoneyInput
                label={t('purchases.lineAmount')}
                value={l.amount_minor}
                onChange={(amount_minor) => update(l.key, { amount_minor })}
                testID={`bill-line-amount-${i}`}
              />
            </View>
          </View>
          {unitCost(l) !== null && Number(l.qty) !== 1 ? (
            <Text variant="small" color="textSecondary" testID={`bill-line-unit-${i}`}>
              {t(Number.isInteger(unitCost(l)) ? 'purchases.perUnit' : 'purchases.perUnitAbout', {
                amount: formatMoney(Math.round(unitCost(l)!)),
                unit: l.unit ? t(`units.one.${l.unit as 'pcs'}`) : t('units.one.pcs'),
              })}
            </Text>
          ) : null}
          <View style={styles.row}>
            {l.item_id ? (
              <View style={styles.flex}>
                <SwitchRow label={t('purchases.addToStock')} value={l.update_stock} onChange={(update_stock) => update(l.key, { update_stock })} />
              </View>
            ) : (
              <Text variant="small" color="textSecondary" style={styles.flex}>
                {t('purchases.notStock')}
              </Text>
            )}
            <Text variant="bodyStrong" tabular>
              {formatMoney(lineTotal(l))}
            </Text>
          </View>
        </Card>
      ))}
      {picking ? (
        <View style={styles.wrap}>
          {items.map((item) => (
            <Chip
              key={item.id}
              icon="package"
              label={item.name}
              onPress={() => {
                onChange([...value, { key: `${item.id}-${value.length}`, item_id: item.id, description: item.name, unit: item.unit, qty: '', amount_minor: null, update_stock: true }]);
                setPicking(false);
              }}
              testID={`bill-item-${item.name}`}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.wrap}>
        <Button label={t('purchases.addStockItem')} icon="package" variant="secondary" size="sm" onPress={() => setPicking(!picking)} testID="bill-add-item" />
        <Button
          label={t('purchases.addOtherLine')}
          icon="plus"
          variant="secondary"
          size="sm"
          onPress={() => onChange([...value, { key: `other-${value.length}-${Date.now()}`, description: '', qty: '1', amount_minor: null, update_stock: false }])}
          testID="bill-add-other"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
