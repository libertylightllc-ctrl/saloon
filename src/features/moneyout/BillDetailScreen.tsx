import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { qtyText } from '@/features/inventory/labels';
import { sharePdf } from '@/lib/exportFile';
import { isLanguage, isRtlLanguage } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';
import {
  BottomSheet,
  Button,
  Card,
  FormError,
  HeaderBand,
  MoneyInput,
  QueryState,
  Screen,
  SectionHeader,
  SegmentTabs,
  StatusPill,
  Text,
  TextField,
  useToast,
} from '@/ui';

import { useBill, usePaySupplier, useReverseBill, type BillDetail, type PayMethod } from './api';
import { billHtml, lineParts } from './billPrint';
import { purchaseNo } from './labels';
import { BILL_STATUS } from './PurchasesScreen';
import { SummaryRow as Row } from './SummaryRow';
import { ReceiptPhoto } from './ReceiptPhoto';

/** A bill with its lines and payments; the owner pays it (any part) or reverses it while unpaid. */
export function BillDetailScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const dates = useDates();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business, branch, role } = useWorkspace();
  const bill = useBill(business.id, id);
  const owner = can(role, 'payOrReverseMoneyOut');
  const [sheet, setSheet] = useState<'pay' | 'reverse' | null>(null);

  /** "10 × 1000 ml", "100 ml", "2": the quantity as on the invoice. */
  const qtyLabel = (l: BillDetail['purchase_bill_lines'][number]) => {
    const { packs } = lineParts(l);
    const unit = l.inventory_items?.unit;
    const pack = packs > 0 ? Number(l.qty) / packs : 1;
    if (!unit) return String(Number(packs.toFixed(3)));
    if (Math.abs(pack - 1) < 1e-9) return qtyText(Number(l.qty), unit, t);
    return t('purchases.packsOf', { n: Number(packs.toFixed(3)), pack: qtyText(pack, unit, t) });
  };
  const paymentLabel = (b: BillDetail) =>
    b.status === 'reversed' ? t('purchases.status.reversed') : b.paid_minor === 0 ? t('purchases.payment.credit') : t(`purchases.status.${b.status}`);
  const print = useMutation({
    mutationFn: (b: BillDetail) =>
      sharePdf(
        billHtml(b, {
          businessName: business.name,
          branchName: branch.name,
          trn: branch.vat_mode === 'on' ? branch.trn : null,
          rtl: isLanguage(i18n.language) && isRtlLanguage(i18n.language),
          ink: theme.colors.text,
          muted: theme.colors.textSecondary,
          line: theme.colors.divider,
          date: dates.day(b.bill_date, 'd MMM yyyy'),
          qtyText: qtyLabel,
          labels: {
            title: t('purchases.entryTitle'),
            number: t('purchases.number'),
            supplier: t('purchases.supplier'),
            invoice: t('purchases.invoiceNo'),
            date: t('purchases.billDate'),
            payment: t('purchases.payment.title'),
            paymentValue: paymentLabel(b),
            product: t('purchases.product'),
            qty: t('purchases.qty'),
            unitPrice: t('purchases.unitPrice'),
            vat: t('purchases.lineVat'),
            total: t('purchases.lineTotalVat'),
            subtotal: t('purchases.subtotal'),
            vatTotal: t('purchases.vatTotal'),
            grandTotal: t('purchases.grandTotal'),
            paid: t('purchases.paid'),
            balance: t('purchases.balance'),
            trn: t('receipt.trn'),
          },
        }),
        purchaseNo(b.number),
      ),
  });

  return (
    <>
      <Screen
        refreshing={bill.isRefetching}
        onRefresh={() => void bill.refetch()}
        header={
          <HeaderBand
            title={bill.data ? purchaseNo(bill.data.number) : t('purchases.bills')}
            subtitle={bill.data?.suppliers?.name}
            onBack
          />
        }
      >
        <QueryState query={bill}>
          {(b) => {
            const left = b.total_minor - b.paid_minor;
            return (
              <View style={styles.body}>
                <View style={styles.row}>
                  <StatusPill status={BILL_STATUS[b.status]} label={t(`purchases.status.${b.status}`)} />
                  <Text color="textSecondary" style={styles.flex}>
                    {[dates.day(b.bill_date, 'd MMM yyyy'), b.invoice_ref].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Card variant="outlined" style={styles.card}>
                  {b.purchase_bill_lines.map((l, i) => {
                    const p = lineParts(l);
                    return (
                      <View key={l.id} style={styles.line} testID={`bill-detail-line-${i}`}>
                        <Text variant="bodyStrong">
                          {l.update_stock ? `${l.description} · ${t('purchases.inStock')}` : l.description}
                        </Text>
                        <View style={styles.row}>
                          <Text variant="small" color="textSecondary" style={styles.flex}>
                            {[
                              `${qtyLabel(l)} · ${t('purchases.each', { amount: formatMoney(p.price) })}`,
                              p.vat > 0 ? `${t('purchases.lineVat')} ${formatMoney(p.vat)}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                          <Text variant="bodyStrong" tabular>
                            {formatMoney(p.gross)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </Card>
                <Card variant="outlined" style={styles.card}>
                  <Row label={t('purchases.subtotal')} value={formatMoney(b.total_minor - b.vat_minor)} testID="bill-detail-subtotal" />
                  {b.vat_minor > 0 ? <Row label={t('purchases.vatTotal')} value={formatMoney(b.vat_minor)} testID="bill-detail-vat" /> : null}
                  <Row label={t('purchases.grandTotal')} value={formatMoney(b.total_minor)} strong testID="bill-detail-total" />
                  <Row label={t('purchases.paid')} value={formatMoney(b.paid_minor)} testID="bill-detail-paid" />
                  {b.status !== 'reversed' ? <Row label={t('purchases.balance')} value={formatMoney(left)} strong testID="bill-detail-left" /> : null}
                  {b.status !== 'reversed' && left > 0 ? (
                    <Row label={t('purchases.due')} value={dates.day(b.due_date, 'd MMM yyyy')} />
                  ) : null}
                </Card>
                {b.supplier_payments.length ? (
                  <View style={styles.card}>
                    <SectionHeader title={t('purchases.payments')} />
                    {b.supplier_payments.map((p) => (
                      <Row key={p.id} label={`${t(`expenses.methods.${p.method}`)} · ${dates.day(p.business_date, 'd MMM')}`} value={formatMoney(p.amount_minor)} />
                    ))}
                  </View>
                ) : null}
                <ReceiptPhoto kind="bill" rowId={b.id} path={b.receipt_path} canAttach={b.status !== 'reversed' && can(role, 'addPurchase')} />
                {b.reverse_reason ? <Text color="textSecondary">{t('purchases.reversedBecause', { reason: b.reverse_reason })}</Text> : null}
                <FormError error={print.error} />
                <Button label={t('purchases.print')} icon="printer" variant="secondary" loading={print.isPending} onPress={() => print.mutate(b)} testID="bill-print" />
                {owner && b.status !== 'reversed' && left > 0 ? (
                  <Button label={t('purchases.pay')} icon="wallet" onPress={() => setSheet('pay')} testID="bill-pay" />
                ) : null}
                {owner && b.status !== 'reversed' && b.paid_minor === 0 ? (
                  <Button label={t('purchases.reverse')} icon="rotate" variant="ghost" onPress={() => setSheet('reverse')} testID="bill-reverse" />
                ) : null}
              </View>
            );
          }}
        </QueryState>
      </Screen>
      {bill.data ? (
        <>
          <BottomSheet open={sheet === 'pay'} onClose={() => setSheet(null)} title={t('purchases.pay')}>
            {sheet === 'pay' ? <PayForm bill={bill.data} onDone={() => setSheet(null)} /> : null}
          </BottomSheet>
          <BottomSheet open={sheet === 'reverse'} onClose={() => setSheet(null)} title={t('purchases.reverse')}>
            {sheet === 'reverse' ? <ReverseForm bill={bill.data} onDone={() => setSheet(null)} /> : null}
          </BottomSheet>
        </>
      ) : null}
    </>
  );
}

function PayForm({ bill, onDone }: { bill: BillDetail; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const pay = usePaySupplier(business.id, branch.id);
  const left = bill.total_minor - bill.paid_minor;
  const [amount, setAmount] = useState<number | null>(left);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [clientRef] = useState(() => Crypto.randomUUID());
  const ok = amount !== null && amount > 0 && amount <= left;
  return (
    <>
      <Text color="textSecondary">{t('purchases.leftToPay', { amount: formatMoney(left) })}</Text>
      <MoneyInput
        label={t('purchases.amountPaid')}
        value={amount}
        onChange={setAmount}
        error={amount !== null && amount > left ? t('purchases.tooMuch', { amount: formatMoney(left) }) : undefined}
        testID="pay-amount"
      />
      <SegmentTabs<PayMethod>
        items={(['cash', 'card', 'bank'] as const).map((m) => ({ key: m, label: t(`expenses.methods.${m}`) }))}
        value={method}
        onChange={setMethod}
        testID="pay-method"
      />
      <FormError error={pay.error} />
      <Button
        label={t('purchases.payAmount', { amount: formatMoney(amount ?? 0) })}
        disabled={!ok}
        loading={pay.isPending}
        onPress={() =>
          pay.mutate(
            { supplier_id: bill.supplier_id, bill_id: bill.id, method, amount_minor: amount!, client_ref: clientRef },
            {
              onSuccess: () => {
                toast(t('purchases.paidToast', { amount: formatMoney(amount!) }));
                onDone();
              },
            },
          )
        }
        testID="pay-confirm"
      />
    </>
  );
}

function ReverseForm({ bill, onDone }: { bill: BillDetail; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const reverse = useReverseBill(business.id, branch.id);
  const [reason, setReason] = useState('');
  return (
    <>
      <Text color="textSecondary">{t('purchases.reverseHint')}</Text>
      <TextField label={t('expenses.reverseReason')} value={reason} onChangeText={setReason} maxLength={200} testID="bill-reverse-reason" />
      <FormError error={reverse.error} />
      <Button
        label={t('purchases.reverse')}
        variant="danger"
        disabled={reason.trim().length < 3}
        loading={reverse.isPending}
        onPress={() =>
          reverse.mutate(
            { id: bill.id, reason: reason.trim() },
            {
              onSuccess: () => {
                toast(t('purchases.reversedToast'));
                onDone();
              },
            },
          )
        }
        testID="bill-reverse-confirm"
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { gap: 2 },
  flex: { flex: 1 },
});
