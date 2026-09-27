import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { spacing } from '@/theme';
import { BottomSheet, Button, Card, FormError, MoneyInput, SectionHeader, Text, useToast } from '@/ui';

import { usePayTips, type TipOwed } from './api';

/** "Pay out tips": what each person is owed, paid in cash from the drawer before the count. */
export function TipsCard({ tips }: { tips: TipOwed[] }) {
  const { t } = useTranslation();
  const [paying, setPaying] = useState<TipOwed | null>(null);
  return (
    <View style={styles.block}>
      <SectionHeader title={t('closing.tips')} />
      <Card variant="outlined" style={styles.card}>
        {tips.length === 0 ? <Text color="textSecondary">{t('closing.noTips')}</Text> : null}
        {tips.map((tip) => (
          <View key={tip.employee_id} style={styles.row} testID={`tips-${tip.full_name}`}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{tip.full_name}</Text>
              <Text variant="small" color="textSecondary" tabular>
                {t('closing.tipsOwed', { amount: formatMoney(tip.owed_minor) })}
              </Text>
            </View>
            <Button label={t('closing.payTips')} size="sm" variant="secondary" onPress={() => setPaying(tip)} testID={`tips-pay-${tip.full_name}`} />
          </View>
        ))}
      </Card>
      <BottomSheet open={paying !== null} onClose={() => setPaying(null)} title={t('closing.payTips')}>
        {paying ? <PayTipsForm tip={paying} onDone={() => setPaying(null)} /> : null}
      </BottomSheet>
    </View>
  );
}

function PayTipsForm({ tip, onDone }: { tip: TipOwed; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const pay = usePayTips(branch.id, business.id);
  const [amount, setAmount] = useState<number | null>(tip.owed_minor);
  const [clientRef] = useState(() => Crypto.randomUUID());
  const tooMuch = amount !== null && amount > tip.owed_minor;
  return (
    <>
      <Text color="textSecondary">{t('closing.payTipsHint', { name: tip.full_name, amount: formatMoney(tip.owed_minor) })}</Text>
      <MoneyInput
        label={t('closing.tipsAmount')}
        value={amount}
        onChange={setAmount}
        error={tooMuch ? t('purchases.tooMuch', { amount: formatMoney(tip.owed_minor) }) : undefined}
        testID="tips-amount"
      />
      <FormError error={pay.error} />
      <Button
        label={t('closing.payTipsAmount', { amount: formatMoney(amount ?? 0) })}
        disabled={amount === null || amount <= 0 || tooMuch}
        loading={pay.isPending}
        onPress={() =>
          pay.mutate(
            { employee_id: tip.employee_id, amount_minor: amount!, client_ref: clientRef },
            {
              onSuccess: () => {
                toast(t('closing.tipsPaid', { amount: formatMoney(amount!), name: tip.full_name }));
                onDone();
              },
            },
          )
        }
        testID="tips-confirm"
      />
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
