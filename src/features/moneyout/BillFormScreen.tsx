import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useCatalog } from '@/features/catalog/api';
import { businessDate, shiftBusinessDate } from '@/lib/dates';
import { formatMoney, sum } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import {
  Button,
  Card,
  Chip,
  DateStrip,
  FormError,
  HeaderBand,
  MoneyInput,
  QueryState,
  Screen,
  SegmentTabs,
  SwitchRow,
  Text,
  TextField,
  useToast,
} from '@/ui';

import { usePostBill, useSuppliers, type PayMethod } from './api';
import {
  BillLines,
  lineNet,
  lineValid,
  lineVat,
  packOf,
  packsOf,
  type LineDraft,
} from './BillLines';
import { purchaseNo } from './labels';
import { PhotoButtons, PickedPreview } from './ReceiptPhoto';
import { useAttachReceipt, type PickedPhoto } from './receipts';
import { SummaryRow } from './SummaryRow';
import { SupplierSheet } from './SupplierSheet';

type Payment = 'credit' | PayMethod;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="bodyStrong">{title}</Text>
      {children}
    </View>
  );
}

/**
 * A supplier's bill laid out like the invoice: supplier, invoice no., date and payment; one row per product (packs,
 * price per pack, VAT 5%, total); then subtotal, VAT, grand total, paid and the supplier's balance. Saving adds the
 * stock, the supplier's balance, the cost, the VAT and the invoice photo in one step.
 */
export function BillFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { business, branch, role } = useWorkspace();
  const owner = can(role, 'payOrReverseMoneyOut');
  const today = businessDate(new Date(), business.timezone);
  const suppliers = useSuppliers(business.id, false);
  const catalog = useCatalog(business.id);
  const post = usePostBill(business.id, branch.id);

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [date, setDate] = useState(today);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [payment, setPayment] = useState<Payment>('credit');
  /** Typed over by the owner; until then a paid bill is paid in full (and follows the total). */
  const [paidAmount, setPaidAmount] = useState<number | null | undefined>(undefined);
  const [clientRef] = useState(() => Crypto.randomUUID());
  const [addingSupplier, setAddingSupplier] = useState(false);
  const attach = useAttachReceipt('bill', business.id);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);

  // Suppliers charge the local tax (5% VAT in the UAE). A tax-registered salon claims it back; for any other it is part of the cost.
  const vatRegistered = branch.vat_mode === 'on';
  const [withVat, setWithVat] = useState(true);
  const subtotal = sum(lines.map(lineNet));
  const rate = branch.tax_rate_bps;
  const vat = sum(lines.map((l) => lineVat(l, withVat, rate)));
  const total = subtotal + vat;
  const paying =
    owner && payment !== 'credit' ? (paidAmount === undefined ? total : (paidAmount ?? 0)) : 0;
  const ready =
    Boolean(supplierId) &&
    lines.length > 0 &&
    lines.every((l) => lineValid(l, withVat, rate)) &&
    subtotal > 0 &&
    paying <= total &&
    (payment === 'credit' || paying > 0);

  const save = () =>
    post.mutate(
      {
        supplier_id: supplierId!,
        invoice_ref: invoiceRef.trim() || null,
        bill_date: date,
        note: null,
        client_ref: clientRef,
        lines: lines.map((l) => ({
          item_id: l.item_id,
          description: l.description.trim(),
          packs: packsOf(l),
          ...(packOf(l) !== undefined ? { pack_size: packOf(l) } : {}),
          unit_price_minor: l.price_minor!,
          vat_minor: lineVat(l, withVat, rate),
          update_stock: Boolean(l.item_id) && l.update_stock,
        })),
        ...(paying > 0 && payment !== 'credit'
          ? { paid_now: { method: payment, amount_minor: paying } }
          : {}),
      },
      {
        onSuccess: async (r) => {
          let photoFailed = false;
          if (photo)
            await attach.mutateAsync({ rowId: r.bill_id, photo }).catch(() => (photoFailed = true));
          toast(
            photoFailed
              ? t('receipts.failedLater')
              : t('purchases.billSaved', { number: purchaseNo(r.number) }),
          );
          router.replace({ pathname: '/purchases/[id]', params: { id: r.bill_id } });
        },
      },
    );

  return (
    <>
      <Screen
        header={
          <HeaderBand title={t('purchases.newBill')} subtitle={t('purchases.numberLater')} onBack />
        }
        footer={
          <Button
            label={t('purchases.saveBill', { amount: formatMoney(total) })}
            onPress={save}
            disabled={!ready}
            loading={post.isPending || attach.isPending}
            testID="bill-save"
          />
        }
      >
        <View style={styles.body}>
          <Section title={t('purchases.supplier')}>
            <QueryState query={suppliers}>
              {(rows) => (
                <View style={styles.wrap}>
                  {rows.map((s) => (
                    <Chip
                      key={s.id}
                      label={s.name}
                      selected={supplierId === s.id}
                      onPress={() => setSupplierId(s.id)}
                      testID={`bill-supplier-${s.name}`}
                    />
                  ))}
                  <Chip
                    icon="plus"
                    label={t('purchases.newSupplier')}
                    onPress={() => setAddingSupplier(true)}
                    testID="bill-supplier-new"
                  />
                </View>
              )}
            </QueryState>
          </Section>
          <TextField
            label={t('purchases.invoiceRef')}
            value={invoiceRef}
            onChangeText={setInvoiceRef}
            maxLength={40}
            testID="bill-invoice"
          />
          {owner ? (
            <Section title={t('purchases.billDate')}>
              <DateStrip
                dates={Array.from({ length: 14 }, (_, i) => shiftBusinessDate(today, i - 13))}
                value={date}
                onChange={setDate}
              />
            </Section>
          ) : null}
          <Section title={t('purchases.payment.title')}>
            {owner ? (
              <SegmentTabs<Payment>
                items={(['credit', 'cash', 'card', 'bank'] as const).map((m) => ({
                  key: m,
                  label:
                    m === 'credit' ? t('purchases.payment.credit') : t(`expenses.methods.${m}`),
                }))}
                value={payment}
                onChange={setPayment}
                testID="bill-payment"
              />
            ) : null}
            <Text variant="small" color="textSecondary">
              {owner
                ? t(
                    payment === 'credit'
                      ? 'purchases.payment.creditHint'
                      : 'purchases.payment.paidHint',
                  )
                : t('purchases.ownerPays')}
            </Text>
          </Section>
          <SwitchRow
            label={t('purchases.withVat')}
            hint={t(vatRegistered ? 'purchases.withVatHint' : 'purchases.withVatCostHint')}
            value={withVat}
            onChange={setWithVat}
            testID="bill-with-vat"
          />
          <Section title={t('purchases.lines')}>
            <QueryState query={catalog}>
              {(data) => (
                <BillLines
                  items={data.items}
                  value={lines}
                  onChange={setLines}
                  withVat={withVat}
                  rate={rate}
                  vatRecoverable={vatRegistered}
                />
              )}
            </QueryState>
          </Section>
          <Section title={t('purchases.photo')}>
            {photo ? (
              <PickedPreview photo={photo} onRemove={() => setPhoto(null)} />
            ) : (
              <PhotoButtons onPicked={setPhoto} />
            )}
          </Section>
          <Card variant="outlined" style={styles.summary} testID="bill-summary">
            <Text variant="h4">{t('purchases.summary')}</Text>
            <SummaryRow
              label={t('purchases.subtotal')}
              value={formatMoney(subtotal)}
              testID="bill-subtotal"
            />
            {withVat ? (
              <SummaryRow
                label={t('purchases.vatTotal')}
                value={formatMoney(vat)}
                testID="bill-vat-total"
              />
            ) : null}
            <SummaryRow
              label={t('purchases.grandTotal')}
              value={formatMoney(total)}
              strong
              testID="bill-total"
            />
            {owner && payment !== 'credit' ? (
              <MoneyInput
                label={t('purchases.amountPaid')}
                value={paidAmount === undefined ? total : paidAmount}
                onChange={setPaidAmount}
                testID="bill-paid-amount"
              />
            ) : null}
            <SummaryRow
              label={t('purchases.paid')}
              value={formatMoney(paying)}
              testID="bill-paid"
            />
            <SummaryRow
              label={t('purchases.balance')}
              value={formatMoney(Math.max(total - paying, 0))}
              strong
              testID="bill-balance"
            />
          </Card>
          <Text variant="small" color="textSecondary">
            {t('purchases.afterSave')}
          </Text>
          <FormError error={post.error} />
        </View>
      </Screen>
      <SupplierSheet
        open={addingSupplier}
        onClose={() => setAddingSupplier(false)}
        onSaved={(id) => {
          setSupplierId(id);
          setAddingSupplier(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summary: { gap: spacing.sm },
});
