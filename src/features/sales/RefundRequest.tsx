import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useDismissRequest, useRefundRequest, useRequestRefund } from '@/features/notifications/api';
import { formatMoney } from '@/lib/money';
import { spacing } from '@/theme';
import { BottomSheet, Button, Card, FormError, MoneyInput, StatusPill, Text, TextField, useToast } from '@/ui';

import type { SaleDetail } from './api';

/** A cashier asks the owner for a refund; the owner sees the request on the sale and refunds or declines it. */
export function RefundRequest({ sale }: { sale: SaleDetail }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { role } = useWorkspace();
  const request = useRefundRequest(sale.id);
  const dismiss = useDismissRequest(sale.id);
  const [asking, setAsking] = useState(false);
  const left = sale.total_minor - sale.refunded_minor;
  const open = request.data;

  return (
    <>
      {open ? (
        <Card variant="tinted" style={styles.card} testID="refund-request">
          <StatusPill status="pending_approval" label={t('refundRequest.open')} />
          <Text>{t('refundRequest.summary', { name: open.members?.display_name ?? '', amount: formatMoney(open.amount_minor) })}</Text>
          <Text color="textOnTint">{open.reason}</Text>
          {role === 'owner' ? (
            <Button
              label={t('refundRequest.decline')}
              variant="ghost"
              size="md"
              loading={dismiss.isPending}
              onPress={() => dismiss.mutate({ id: open.id, note: null }, { onSuccess: () => toast(t('refundRequest.declined')) })}
              testID="refund-request-decline"
            />
          ) : null}
        </Card>
      ) : null}
      {role === 'cashier' && !open && left > 0 ? (
        <Button label={t('refundRequest.ask')} icon="rotate" variant="ghost" onPress={() => setAsking(true)} testID="refund-request-ask" />
      ) : null}
      <BottomSheet open={asking} onClose={() => setAsking(false)} title={t('refundRequest.ask')}>
        {asking ? <AskForm sale={sale} left={left} onDone={() => setAsking(false)} /> : null}
      </BottomSheet>
    </>
  );
}

function AskForm({ sale, left, onDone }: { sale: SaleDetail; left: number; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const ask = useRequestRefund(sale.id);
  const [amount, setAmount] = useState<number | null>(left);
  const [reason, setReason] = useState('');
  const ok = amount !== null && amount > 0 && amount <= left && reason.trim().length >= 3;
  return (
    <View style={styles.form}>
      <Text color="textSecondary">{t('refundRequest.hint')}</Text>
      <MoneyInput
        label={t('sales.refundAmount')}
        value={amount}
        onChange={setAmount}
        error={amount !== null && amount > left ? t('sales.tooMuch', { amount: formatMoney(left) }) : undefined}
        testID="refund-request-amount"
      />
      <TextField label={t('sales.reason')} value={reason} onChangeText={setReason} maxLength={200} testID="refund-request-reason" />
      <FormError error={ask.error} />
      <Button
        label={t('refundRequest.send')}
        disabled={!ok}
        loading={ask.isPending}
        onPress={() =>
          ask.mutate(
            { amount_minor: amount!, reason: reason.trim() },
            {
              onSuccess: () => {
                toast(t('refundRequest.sent'));
                onDone();
              },
            },
          )
        }
        testID="refund-request-send"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  form: { gap: spacing.md },
});
