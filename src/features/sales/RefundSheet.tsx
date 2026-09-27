import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatMoney, type Minor } from '@/lib/money';
import { BottomSheet, Button, FormError, MoneyInput, SegmentTabs, SwitchRow, Text, TextField, useToast } from '@/ui';

import { useRefundSale, type PaymentMethod, type SaleDetail } from './api';

/** Owner only. Money goes back by the chosen method, with a reason; the sale row stays. */
export function RefundSheet({ sale, open, onClose }: { sale: SaleDetail; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t('sales.refundTitle', { number: sale.number })}>
      {open ? <RefundForm sale={sale} onDone={onClose} /> : null}
    </BottomSheet>
  );
}

/** Mounted each time the sheet opens, so amount, reason and the idempotency key start fresh. */
function RefundForm({ sale, onDone }: { sale: SaleDetail; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const refund = useRefundSale(sale.branch_id);
  const left = sale.total_minor - sale.refunded_minor;
  const firstMethod = (sale.sale_payments.find((p) => p.method !== 'bank')?.method ?? 'cash') as PaymentMethod;

  const [amount, setAmount] = useState<Minor | null>(left);
  const [method, setMethod] = useState<PaymentMethod>(firstMethod);
  const [reason, setReason] = useState('');
  const [key] = useState(() => Crypto.randomUUID());
  const [restock, setRestock] = useState(false);
  // Products go back on the shelf only with a full refund (a part refund cannot say which ones).
  const canRestock = sale.sale_lines.some((l) => l.kind === 'retail') && amount === left;

  const valid = amount !== null && amount > 0 && amount <= left && reason.trim().length >= 3;

  return (
    <>
      <Text color="textSecondary">{t('sales.refundable', { amount: formatMoney(left) })}</Text>
      <MoneyInput
        label={t('sales.refundAmount')}
        value={amount}
        onChange={setAmount}
        error={amount !== null && amount > left ? t('sales.tooMuch', { amount: formatMoney(left) }) : undefined}
        testID="refund-amount"
      />
      <SegmentTabs<PaymentMethod>
        items={(['cash', 'card', 'wallet'] as const).map((m) => ({ key: m, label: t(`sale.methods.${m}`) }))}
        value={method}
        onChange={setMethod}
        testID="refund-method"
      />
      <TextField
        label={t('sales.reason')}
        hint={t('sales.reasonHint')}
        value={reason}
        onChangeText={setReason}
        maxLength={200}
        testID="refund-reason"
      />
      {canRestock ? (
        <SwitchRow label={t('sales.restock')} hint={t('sales.restockHint')} value={restock} onChange={setRestock} testID="refund-restock" />
      ) : null}
      <FormError error={refund.error} />
      <Button
        label={t('sales.confirmRefund', { amount: formatMoney(amount ?? 0) })}
        disabled={!valid}
        loading={refund.isPending}
        onPress={() =>
          refund.mutate(
            {
              sale_id: sale.id,
              amount_minor: amount!,
              method,
              reason: reason.trim(),
              idempotency_key: key,
              restock: canRestock && restock,
            },
            {
              onSuccess: () => {
                toast(t('sales.refunded', { amount: formatMoney(amount!) }));
                onDone();
              },
            },
          )
        }
        testID="refund-confirm"
      />
    </>
  );
}
