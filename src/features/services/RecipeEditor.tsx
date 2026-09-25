import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { InventoryItem } from '@/features/catalog/api';
import { semantic, spacing } from '@/theme';
import { Button, Chip, IconButton, Text, TextField } from '@/ui';

export const UNITS = ['ml', 'g', 'pcs', 'pairs'] as const;
export type Unit = (typeof UNITS)[number];

export interface RecipeDraft {
  key: string;
  item_id?: string;
  item_name: string;
  unit: Unit;
  qty: string;
}

/** Products one service uses up. Pick an existing stock item or type a new one (created on save). */
export function RecipeEditor({
  items,
  value,
  onChange,
  error,
}: {
  items: InventoryItem[];
  value: RecipeDraft[];
  onChange: (next: RecipeDraft[]) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<Unit>('ml');

  const update = (key: string, patch: Partial<RecipeDraft>) =>
    onChange(value.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const unused = items.filter((i) => !value.some((l) => l.item_id === i.id));

  const addNew = () => {
    const clean = name.trim();
    if (!clean) return;
    const existing = items.find((i) => i.name.toLowerCase() === clean.toLowerCase());
    onChange([
      ...value,
      existing
        ? { key: existing.id, item_id: existing.id, item_name: existing.name, unit: existing.unit as Unit, qty: '' }
        : { key: `new-${clean}`, item_name: clean, unit, qty: '' },
    ]);
    setName('');
    setAdding(false);
  };

  return (
    <View style={styles.box}>
      {value.length === 0 ? (
        <Text variant="small" color="textSecondary">
          {t('services.recipeEmpty')}
        </Text>
      ) : (
        value.map((line) => (
          <View key={line.key} style={styles.line}>
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {line.item_name}
              </Text>
              {!line.item_id ? (
                <Text variant="small" color="primaryText">
                  {t('services.newItem')}
                </Text>
              ) : null}
            </View>
            <View style={styles.qty}>
              <TextField
                value={line.qty}
                onChangeText={(qty) => update(line.key, { qty: qty.replace(/[^0-9.]/g, '') })}
                keyboardType="decimal-pad"
                accessibilityLabel={t('services.qtyFor', { item: line.item_name })}
                end={<Text color="textSecondary">{t(`units.${line.unit}`)}</Text>}
                testID={`recipe-qty-${line.item_name}`}
              />
            </View>
            <IconButton
              icon="x"
              variant="plain"
              accessibilityLabel={t('services.removeItem', { item: line.item_name })}
              onPress={() => onChange(value.filter((l) => l.key !== line.key))}
            />
          </View>
        ))
      )}
      {error ? (
        <Text variant="small" style={{ color: semantic.error.pressed }}>
          {error}
        </Text>
      ) : null}
      {unused.length ? (
        <View style={styles.wrap}>
          {unused.map((item) => (
            <Chip
              key={item.id}
              icon="plus"
              label={item.name}
              onPress={() =>
                onChange([
                  ...value,
                  { key: item.id, item_id: item.id, item_name: item.name, unit: item.unit as Unit, qty: '' },
                ])
              }
              testID={`recipe-add-${item.name}`}
            />
          ))}
        </View>
      ) : null}
      {adding ? (
        <View style={styles.newBox}>
          <TextField label={t('services.itemName')} value={name} onChangeText={setName} testID="recipe-new-name" />
          <View style={styles.wrap}>
            {UNITS.map((u) => (
              <Chip key={u} label={t(`units.${u}`)} selected={unit === u} onPress={() => setUnit(u)} />
            ))}
          </View>
          <Button label={t('services.addItem')} size="md" variant="secondary" onPress={addNew} disabled={!name.trim()} testID="recipe-new-add" />
        </View>
      ) : (
        <Button label={t('services.newItemButton')} icon="plus" variant="ghost" size="md" onPress={() => setAdding(true)} testID="recipe-new" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  flex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qty: { width: 120 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  newBox: { gap: spacing.sm },
});
