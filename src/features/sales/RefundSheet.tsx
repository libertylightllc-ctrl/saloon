import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatMoney, type Minor } from '@/lib/money';
import { BottomSheet, Button, FormError, MoneyInput, SegmentTabs, SwitchRow, Text, TextField, useToast } from '@/ui';

import { useTerms } from '@/features/mode/useTerms';

import { useRefundSale, type PaymentMethod, type SaleDetail } from './api';

/**
 * Owner only. Money goes back by the chosen method, with a reason; the sale row stays. The tip is the stylist's (owner,
 * 9 Nov 2026): a refund comes out of the services and products, and out of the tip only when "Also refund the tip" is on.
 */
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
  const terms = useTerms();
  const left = sale.total_minor - sale.refunded_minor;
  const tipLeft = sale.tip_minor - sale.refunds.reduce((n, r) => n + r.tip_minor, 0);
  const restLeft = left - tipLeft;
  const firstMethod = (sale.sale_payments.find((p) => p.method !== 'bank')?.method ?? 'cash') as PaymentMethod;

  const [refundTip, setRefundTip] = useState(restLeft <= 0);
  const most = refundTip ? left : restLeft;
  const [amount, setAmount] = useState<Minor | null>(most);
  const [method, setMethod] = useState<PaymentMethod>(firstMethod);
  const [reason, setReason] = useState('');
  const [key] = useState(() => Crypto.randomUUID());
  const [restock, setRestock] = useState(false);
  // Products go back on the shelf only with a full refund (a part refund cannot say which ones).
  const canRestock = sale.sale_lines.some((l) => l.kind === 'retail') && amount !== null && amount >= restLeft;

  const valid = amount !== null && amount > 0 && amount <= most && reason.trim().length >= 3;

  const onRefundTip = (on: boolean) => {
    setRefundTip(on);
    // The amount follows: everything with the tip, or no more than the services and products without it.
    if (on && amount === restLeft) setAmount(left);
    if (!on && (amount ?? 0) > restLeft) setAmount(restLeft);
  };

  return (
    <>
      <Text color="textSecondary">{t('sales.refundable', { amount: formatMoney(most) })}</Text>
      <MoneyInput
        label={t('sales.refundAmount')}
        value={amount}
        onChange={setAmount}
        error={amount !== null && amount > most ? t('sales.tooMuch', { amount: formatMoney(most) }) : undefined}
        testID="refund-amount"
      />
      {tipLeft > 0 && restLeft > 0 ? (
        <SwitchRow
          label={t('sales.refundTip')}
          hint={t('sales.refundTipHint', { amount: formatMoney(tipLeft), staff: terms.staff })}
          value={refundTip}
          onChange={onRefundTip}
          testID="refund-tip"
        />
      ) : null}
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
              refund_tip: refundTip,
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
