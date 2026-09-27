import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney, normalizeDigits } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, FormError, HeaderBand, QueryState, Screen, Text, TextField, useToast } from '@/ui';

import { useInventory, useRecordCount } from './api';
import { qtyText } from './labels';

/** Stock count: type what is on the shelf for any items; only the differences are recorded. Owner. */
export function CountScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { business, branch } = useWorkspace();
  const items = useInventory(branch.id);
  const record = useRecordCount(branch.id, business.id);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [clientRef] = useState(() => Crypto.randomUUID());

  const parsed = Object.entries(counts)
    .filter(([, v]) => v.trim() !== '')
    .map(([item_id, v]) => ({ item_id, counted_qty: Number(normalizeDigits(v).replace(',', '.')) }));
  const valid = parsed.length > 0 && parsed.every((c) => Number.isFinite(c.counted_qty) && c.counted_qty >= 0);

  return (
    <Screen
      header={<HeaderBand title={t('inventory.count')} subtitle={t('inventory.countHint')} onBack />}
      footer={
        <View style={styles.footer}>
          <FormError error={record.error} />
          <Button
            label={t('inventory.countSave', { n: parsed.length })}
            disabled={!valid}
            loading={record.isPending}
            onPress={() =>
              record.mutate(
                { counts: parsed, note: note.trim() || null, client_ref: clientRef },
                {
                  onSuccess: (r) => {
                    toast(t('inventory.counted', { n: r.items_changed, value: formatMoney(r.value_change_minor) }));
                    router.back();
                  },
                },
              )
            }
            testID="count-save"
          />
        </View>
      }
    >
      <QueryState query={items}>
        {(rows) => (
          <View style={styles.body}>
            {rows
              .filter((i) => i.active && i.kind !== 'tool')
              .map((i) => {
                const typed = counts[i.item_id] ?? '';
                const n = Number(normalizeDigits(typed).replace(',', '.'));
                const diff = typed.trim() !== '' && Number.isFinite(n) ? n - i.qty : 0;
                return (
                  <View key={i.item_id} style={styles.row}>
                    <View style={styles.flex}>
                      <Text variant="bodyStrong">{i.name}</Text>
                      <Text variant="small" color="textSecondary">
                        {t('inventory.system', { qty: qtyText(i.qty, i.unit, t) })}
                        {diff !== 0 ? ` · ${diff > 0 ? '+' : ''}${qtyText(diff, i.unit, t)}` : ''}
                      </Text>
                    </View>
                    <View style={styles.input}>
                      <TextField
                        value={typed}
                        onChangeText={(v) => setCounts((c) => ({ ...c, [i.item_id]: v }))}
                        keyboardType="decimal-pad"
                        placeholder={String(Number(i.qty.toFixed(3)))}
                        aria-label={t('inventory.countedFor', { name: i.name })}
                        testID={`count-${i.name}`}
                      />
                    </View>
                  </View>
                );
              })}
            <TextField label={t('inventory.countNote')} value={note} onChangeText={setNote} maxLength={200} testID="count-note" />
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  input: { width: 110 },
  footer: { gap: spacing.sm },
});
