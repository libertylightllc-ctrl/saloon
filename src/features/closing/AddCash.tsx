import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { BottomSheet, Button, FormError, MoneyInput, SegmentTabs, Text, TextField, useToast } from '@/ui';

import { useAddDrawerCash } from './api';

type From = 'owner' | 'bank';

/**
 * "Add cash": cash put into the drawer today — change for the day, or the owner's money for a cash payment — so
 * expected cash matches what is really there (owner's fix list #9). A cash payment bigger than the drawer is refused.
 */
export function AddCash() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.row}>
      <Button
        label={t('closing.addCash.button')}
        icon="plus"
        size="sm"
        variant="secondary"
        onPress={() => setOpen(true)}
        testID="closing-add-cash"
      />
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('closing.addCash.title')}>
        {open ? <AddCashForm onDone={() => setOpen(false)} /> : null}
      </BottomSheet>
    </View>
  );
}

function AddCashForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const add = useAddDrawerCash(branch.id, business.id);
  const [amount, setAmount] = useState<number | null>(null);
  const [from, setFrom] = useState<From>('owner');
  const [note, setNote] = useState('');
  return (
    <>
      <Text color="textSecondary">{t('closing.addCash.hint')}</Text>
      <MoneyInput label={t('closing.addCash.amount')} value={amount} onChange={setAmount} testID="add-cash-amount" />
      <SegmentTabs<From>
        items={[
          { key: 'owner', label: t('closing.addCash.from.owner') },
          { key: 'bank', label: t('closing.addCash.from.bank') },
        ]}
        value={from}
        onChange={setFrom}
        testID="add-cash-from"
      />
      <TextField label={t('closing.addCash.note')} value={note} onChangeText={setNote} maxLength={200} testID="add-cash-note" />
      <FormError error={add.error} />
      <Button
        label={t('closing.addCash.save')}
        disabled={amount === null || amount <= 0}
        loading={add.isPending}
        onPress={() =>
          add.mutate(
            { amount_minor: amount!, from, note },
            {
              onSuccess: () => {
                toast(t('closing.addCash.saved', { amount: formatMoney(amount!) }));
                onDone();
              },
            },
          )
        }
        testID="add-cash-save"
      />
    </>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row' } });
