import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { activeCurrency, formatMoney, normalizeDigits } from '@/lib/money';
import { spacing } from '@/theme';
import { BottomSheet, Button, Text, TextField } from '@/ui';

import { countTotal, denominationsFor, type Denominations } from './count';

/** Count notes and coins; the total becomes the counted cash. */
export function DenominationSheet({
  open,
  initial,
  onClose,
  onDone,
}: {
  open: boolean;
  initial: Denominations;
  onClose: () => void;
  onDone: (counts: Denominations, total: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t('closing.denominations')}>
      {open ? <Counter initial={initial} onDone={onDone} /> : null}
    </BottomSheet>
  );
}

function Counter({ initial, onDone }: { initial: Denominations; onDone: (counts: Denominations, total: number) => void }) {
  const { t } = useTranslation();
  const [counts, setCounts] = useState<Denominations>(initial);
  const [list] = useState(() => denominationsFor());
  const total = countTotal(counts, list);
  const currency = activeCurrency();
  return (
    <>
      <View style={styles.grid}>
        {list.map((d) => (
          <View key={d.key} style={styles.cell}>
            <TextField
              label={t(d.coin ? 'closing.coin' : 'closing.note', { currency, value: d.label })}
              value={counts[d.key] ? String(counts[d.key]) : ''}
              onChangeText={(text) => {
                const n = Number.parseInt(normalizeDigits(text).replace(/\D/g, ''), 10);
                setCounts((c) => ({ ...c, [d.key]: Number.isFinite(n) ? n : 0 }));
              }}
              keyboardType="number-pad"
              placeholder="0"
              maxLength={5}
              testID={`denom-${d.key}`}
            />
          </View>
        ))}
      </View>
      <Text variant="h4" tabular testID="denom-total">
        {t('closing.denominationTotal', { amount: formatMoney(total) })}
      </Text>
      <Button label={t('closing.useCount')} onPress={() => onDone(counts, total)} testID="denom-done" />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: '31%', flexGrow: 1 },
});
