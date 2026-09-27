import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney, multiply, normalizeDigits, sum } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, FormError, HeaderBand, MoneyInput, QueryState, Screen, Text, TextField, useToast } from '@/ui';

import { useInventory, useOpeningStock } from './api';
import { qtyText } from './labels';

interface Draft {
  qty: string;
  cost: number | null;
}

/** Opening stock (owner): what is on the shelves and what each cost; posted to the books at that cost. */
export function OpeningStockScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { business, branch } = useWorkspace();
  const items = useInventory(branch.id);
  const save = useOpeningStock(branch.id, business.id);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const lines = Object.entries(drafts)
    .map(([item_id, d]) => ({ item_id, qty: Number(normalizeDigits(d.qty).replace(',', '.')), unit_cost_minor: d.cost }))
    .filter((l) => l.qty > 0);
  const valid = lines.length > 0 && lines.every((l) => Number.isFinite(l.qty) && l.unit_cost_minor !== null && l.unit_cost_minor >= 0);
  const value = valid ? sum(lines.map((l) => multiply(l.unit_cost_minor!, l.qty))) : 0;
  const set = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { qty: d[id]?.qty ?? '', cost: d[id]?.cost ?? null, ...patch } }));

  return (
    <Screen
      header={<HeaderBand title={t('inventory.opening.title')} subtitle={t('inventory.opening.hint')} onBack />}
      footer={
        <View style={styles.footer}>
          <FormError error={save.error} />
          <Button
            label={t('inventory.opening.save', { value: formatMoney(value) })}
            disabled={!valid}
            loading={save.isPending}
            onPress={() =>
              save.mutate(
                { items: lines.map((l) => ({ item_id: l.item_id, qty: l.qty, unit_cost_minor: l.unit_cost_minor! })) },
                {
                  onSuccess: () => {
                    toast(t('inventory.opening.saved', { n: lines.length }));
                    router.back();
                  },
                },
              )
            }
            testID="opening-save"
          />
        </View>
      }
    >
      <QueryState query={items}>
        {(rows) => (
          <View style={styles.body}>
            {rows
              .filter((i) => i.active)
              .map((i) => (
                <View key={i.item_id} style={styles.item}>
                  <Text variant="bodyStrong">{i.name}</Text>
                  <Text variant="small" color="textSecondary">
                    {t('inventory.system', { qty: qtyText(i.qty, i.unit, t) })}
                  </Text>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <TextField
                        label={t('inventory.opening.qty', { unit: t(`units.${i.unit}`) })}
                        value={drafts[i.item_id]?.qty ?? ''}
                        onChangeText={(qty) => set(i.item_id, { qty })}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        testID={`opening-qty-${i.name}`}
                      />
                    </View>
                    <View style={styles.flex}>
                      <MoneyInput
                        label={t('inventory.opening.cost')}
                        value={drafts[i.item_id]?.cost ?? null}
                        onChange={(cost) => set(i.item_id, { cost })}
                        testID={`opening-cost-${i.name}`}
                      />
                    </View>
                  </View>
                </View>
              ))}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  item: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  footer: { gap: spacing.sm },
});
