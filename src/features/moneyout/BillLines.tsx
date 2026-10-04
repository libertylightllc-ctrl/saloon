import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { InventoryItem } from '@/features/catalog/api';
import { qtyText } from '@/features/inventory/labels';
import { formatMoney, multiply, normalizeDigits, vatOnTop, type Minor, type TaxRate } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, Card, Chip, IconButton, MoneyInput, SwitchRow, Text, TextField } from '@/ui';

/** One row of the supplier's invoice: packs × price per pack, its VAT, its total. */
export interface LineDraft {
  key: string;
  item_id?: string;
  description: string;
  unit?: string;
  /** Packs (or pieces) as on the invoice. */
  qty: string;
  /** What one pack holds, in the item's stock unit (a 1 L bottle = 1000 ml). Stock lines only. */
  pack: string;
  /** Price of one pack, before VAT. */
  price_minor: Minor | null;
  /** The line's VAT when typed over to match the invoice; otherwise 5% of the line. */
  vat_edited: Minor | null;
  update_stock: boolean;
}

const num = (s: string) => Number(normalizeDigits(s.trim()).replace(',', '.'));
const qtyOk = (s: string) => s.trim() !== '' && Number.isFinite(num(s)) && num(s) > 0;

export const lineNet = (l: LineDraft): Minor =>
  l.price_minor !== null && qtyOk(l.qty) ? multiply(l.price_minor, num(l.qty)) : 0;
/** The supplier's tax on a line, at the branch's rate unless typed in from the invoice. */
export const lineVat = (l: LineDraft, withVat: boolean, rate: TaxRate): Minor =>
  withVat ? (l.vat_edited ?? vatOnTop(lineNet(l), rate)) : 0;
export const lineValid = (l: LineDraft, withVat: boolean, rate: TaxRate) =>
  l.description.trim().length > 0 &&
  qtyOk(l.qty) &&
  l.price_minor !== null &&
  (!l.item_id || qtyOk(l.pack)) &&
  lineVat(l, withVat, rate) <= lineNet(l);
/** How much goes into stock, in the item's unit: 10 packs of 1000 ml = 10,000 ml. */
export const stockQty = (l: LineDraft) =>
  qtyOk(l.qty) ? num(l.qty) * (l.item_id && qtyOk(l.pack) ? num(l.pack) : 1) : 0;
export const packOf = (l: LineDraft) => (l.item_id && qtyOk(l.pack) ? num(l.pack) : undefined);
export const packsOf = (l: LineDraft) => num(l.qty);

export function newItemLine(item: InventoryItem, n: number): LineDraft {
  return {
    key: `${item.id}-${n}-${Date.now()}`,
    item_id: item.id,
    description: item.name,
    unit: item.unit,
    qty: '',
    pack: String(Number(item.pack_size ?? 1)),
    price_minor: null,
    vat_edited: null,
    update_stock: true,
  };
}

interface Props {
  items: InventoryItem[];
  value: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  withVat: boolean;
  /** The branch's tax rate. */
  rate: TaxRate;
  /** VAT the salon can claim back stays out of stock cost; otherwise it is part of it. */
  vatRecoverable: boolean;
}

/** What was bought, as on the supplier's invoice: stock items (added to stock) or anything else ("Delivery"). */
export function BillLines({ items, value, onChange, withVat, rate, vatRecoverable }: Props) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  const update = (key: string, patch: Partial<LineDraft>) =>
    onChange(value.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const unitOne = (unit?: string) => t(`units.one.${(unit ?? 'pcs') as 'pcs'}`);

  return (
    <View style={styles.box}>
      {value.map((l, i) => {
        const net = lineNet(l);
        const vat = lineVat(l, withVat, rate);
        const qty = stockQty(l);
        const cost =
          qty > 0 && l.price_minor !== null ? (net + (vatRecoverable ? 0 : vat)) / qty : null;
        return (
          <Card
            key={l.key}
            variant="outlined"
            style={styles.card}
            padding={spacing.md}
            testID={`bill-line-${i}`}
          >
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
              <IconButton
                icon="x"
                variant="plain"
                accessibilityLabel={t('purchases.removeLine')}
                onPress={() => onChange(value.filter((x) => x.key !== l.key))}
              />
            </View>
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField
                  label={t(l.item_id ? 'purchases.qtyPacks' : 'purchases.qty')}
                  value={l.qty}
                  onChangeText={(v) =>
                    update(l.key, { qty: v.replace(/[^0-9.,٠-٩۰-۹]/g, ''), vat_edited: null })
                  }
                  keyboardType="decimal-pad"
                  testID={`bill-line-qty-${i}`}
                />
              </View>
              {l.item_id ? (
                <View style={styles.flex}>
                  <TextField
                    label={t('purchases.packHolds', {
                      unit: t(`units.${(l.unit ?? 'pcs') as 'pcs'}`),
                    })}
                    value={l.pack}
                    onChangeText={(v) => update(l.key, { pack: v.replace(/[^0-9.,٠-٩۰-۹]/g, '') })}
                    keyboardType="decimal-pad"
                    testID={`bill-line-pack-${i}`}
                  />
                </View>
              ) : null}
            </View>
            <View style={styles.row}>
              <View style={styles.flex}>
                <MoneyInput
                  label={t('purchases.unitPrice')}
                  value={l.price_minor}
                  onChange={(price_minor) => update(l.key, { price_minor, vat_edited: null })}
                  testID={`bill-line-price-${i}`}
                />
              </View>
              {withVat ? (
                <View style={styles.flex}>
                  <MoneyInput
                    label={t('purchases.lineVat')}
                    value={vat}
                    onChange={(vat_edited) => update(l.key, { vat_edited })}
                    error={vat > net ? t('purchases.vatTooMuch') : undefined}
                    testID={`bill-line-vat-${i}`}
                  />
                </View>
              ) : null}
            </View>
            {l.item_id && qty > 0 ? (
              <Text variant="small" color="textSecondary" testID={`bill-line-stock-${i}`}>
                {[
                  t('purchases.intoStock', { qty: qtyText(qty, l.unit ?? 'pcs', t) }),
                  cost !== null
                    ? t(Number.isInteger(cost) ? 'purchases.perUnit' : 'purchases.perUnitAbout', {
                        amount: formatMoney(Math.round(cost)),
                        unit: unitOne(l.unit),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
            <View style={styles.row}>
              {l.item_id ? (
                <View style={styles.flex}>
                  <SwitchRow
                    label={t('purchases.addToStock')}
                    value={l.update_stock}
                    onChange={(update_stock) => update(l.key, { update_stock })}
                  />
                </View>
              ) : (
                <Text variant="small" color="textSecondary" style={styles.flex}>
                  {t('purchases.notStock')}
                </Text>
              )}
              <View style={styles.total}>
                <Text variant="small" color="textSecondary">
                  {t(withVat ? 'purchases.lineTotalVat' : 'purchases.lineTotal')}
                </Text>
                <Text variant="bodyStrong" tabular testID={`bill-line-total-${i}`}>
                  {formatMoney(net + vat)}
                </Text>
              </View>
            </View>
          </Card>
        );
      })}
      {picking ? (
        <View style={styles.wrap}>
          {items.map((item) => (
            <Chip
              key={item.id}
              icon="package"
              label={item.name}
              onPress={() => {
                onChange([...value, newItemLine(item, value.length)]);
                setPicking(false);
              }}
              testID={`bill-item-${item.name}`}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.wrap}>
        <Button
          label={t('purchases.addStockItem')}
          icon="package"
          variant="secondary"
          size="sm"
          onPress={() => setPicking(!picking)}
          testID="bill-add-item"
        />
        <Button
          label={t('purchases.addOtherLine')}
          icon="plus"
          variant="secondary"
          size="sm"
          onPress={() =>
            onChange([
              ...value,
              {
                key: `other-${value.length}-${Date.now()}`,
                description: '',
                qty: '1',
                pack: '1',
                price_minor: null,
                vat_edited: null,
                update_stock: false,
              },
            ])
          }
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
  total: { alignItems: 'flex-end' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
