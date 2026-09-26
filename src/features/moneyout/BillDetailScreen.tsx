import * as Crypto from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
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
import { BILL_STATUS } from './PurchasesScreen';

function Row({ label, value, strong, testID }: { label: string; value: string; strong?: boolean; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text variant={strong ? 'bodyStrong' : 'body'} color={strong ? 'text' : 'textSecondary'} style={styles.flex}>
        {label}
      </Text>
      <Text variant={strong ? 'h4' : 'bodyStrong'} tabular testID={testID}>
        {value}
      </Text>
    </View>
  );
}

/** A bill with its lines and payments; the owner pays it (any part) or reverses it while unpaid. */
export function BillDetailScreen() {
  const { t } = useTranslation();
  const dates = useDates();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business, role } = useWorkspace();
  const bill = useBill(business.id, id);
  const owner = can(role, 'payOrReverseMoneyOut');
  const [sheet, setSheet] = useState<'pay' | 'reverse' | null>(null);

  return (
    <>
      <Screen
        refreshing={bill.isRefetching}
        onRefresh={() => void bill.refetch()}
        header={
          <HeaderBand
            title={bill.data ? t('purchases.billNumber', { number: bill.data.number }) : t('purchases.bills')}
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
                  {b.purchase_bill_lines.map((l) => (
                    <Row
                      key={l.id}
                      label={`${Number(l.qty)} × ${l.description}${l.update_stock ? ` · ${t('purchases.inStock')}` : ''}`}
                      value={formatMoney(l.total_minor)}
                    />
                  ))}
                </Card>
                <Card variant="outlined" style={styles.card}>
                  <Row label={t('purchases.total')} value={formatMoney(b.total_minor)} strong testID="bill-detail-total" />
                  <Row label={t('purchases.paid')} value={formatMoney(b.paid_minor)} testID="bill-detail-paid" />
                  {b.status !== 'reversed' ? <Row label={t('purchases.left')} value={formatMoney(left)} testID="bill-detail-left" /> : null}
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
                {b.reverse_reason ? <Text color="textSecondary">{t('purchases.reversedBecause', { reason: b.reverse_reason })}</Text> : null}
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
  flex: { flex: 1 },
});
