import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useCatalog } from '@/features/catalog/api';
import { businessDate, shiftBusinessDate } from '@/lib/dates';
import { formatMoney, sum, vatOnTop } from '@/lib/money';
import { VAT_BPS } from '@/features/sale/basket';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import {
  Button,
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
import { BillLines, lineTotal, lineValid, type LineDraft } from './BillLines';
import { PhotoButtons, PickedPreview } from './ReceiptPhoto';
import { useAttachReceipt, type PickedPhoto } from './receipts';
import { SupplierSheet } from './SupplierSheet';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="bodyStrong">{title}</Text>
      {children}
    </View>
  );
}

/** A supplier's bill: stock lines add stock at their cost; the owner can also record paying it now. */
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
  const [paidNow, setPaidNow] = useState(false);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [clientRef] = useState(() => Crypto.randomUUID());
  const [addingSupplier, setAddingSupplier] = useState(false);
  const attach = useAttachReceipt('bill', business.id);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);

  // VAT on the supplier's tax invoice (5% on top of the lines), for a VAT-registered salon; editable to match the invoice.
  const vatRegistered = branch.vat_mode === 'on';
  const [withVat, setWithVat] = useState(false);
  const [vatEdited, setVatEdited] = useState<number | null>(null);
  const net = sum(lines.map(lineTotal));
  const vat = vatRegistered && withVat ? (vatEdited ?? vatOnTop(net, VAT_BPS)) : 0;
  const total = net + vat;
  const paying = owner && paidNow ? (paidAmount ?? total) : 0;
  const ready = Boolean(supplierId) && lines.length > 0 && lines.every(lineValid) && net > 0 && vat <= net && paying <= total;

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
          qty: Number(l.qty),
          total_minor: l.amount_minor!,
          update_stock: Boolean(l.item_id) && l.update_stock,
        })),
        vat_minor: vat,
        ...(paying > 0 ? { paid_now: { method, amount_minor: paying } } : {}),
      },
      {
        onSuccess: async (r) => {
          let photoFailed = false;
          if (photo) await attach.mutateAsync({ rowId: r.bill_id, photo }).catch(() => (photoFailed = true));
          toast(photoFailed ? t('receipts.failedLater') : t('purchases.billSaved', { number: r.number }));
          router.replace({ pathname: '/purchases/[id]', params: { id: r.bill_id } });
        },
      },
    );

  return (
    <>
      <Screen
        header={<HeaderBand title={t('purchases.newBill')} onBack />}
        footer={<Button label={t('purchases.saveBill', { amount: formatMoney(total) })} onPress={save} disabled={!ready} loading={post.isPending || attach.isPending} testID="bill-save" />}
      >
        <View style={styles.body}>
          <Section title={t('purchases.supplier')}>
            <QueryState query={suppliers}>
              {(rows) => (
                <View style={styles.wrap}>
                  {rows.map((s) => (
                    <Chip key={s.id} label={s.name} selected={supplierId === s.id} onPress={() => setSupplierId(s.id)} testID={`bill-supplier-${s.name}`} />
                  ))}
                  <Chip icon="plus" label={t('purchases.newSupplier')} onPress={() => setAddingSupplier(true)} testID="bill-supplier-new" />
                </View>
              )}
            </QueryState>
          </Section>
          <TextField label={t('purchases.invoiceRef')} value={invoiceRef} onChangeText={setInvoiceRef} maxLength={40} testID="bill-invoice" />
          {owner ? (
            <Section title={t('purchases.billDate')}>
              <DateStrip dates={Array.from({ length: 14 }, (_, i) => shiftBusinessDate(today, i - 13))} value={date} onChange={setDate} />
            </Section>
          ) : null}
          <Section title={t('receipts.photo')}>
            {photo ? <PickedPreview photo={photo} onRemove={() => setPhoto(null)} /> : <PhotoButtons onPicked={setPhoto} />}
          </Section>
          <Section title={t('purchases.lines')}>
            <QueryState query={catalog}>{(data) => <BillLines items={data.items} value={lines} onChange={setLines} />}</QueryState>
          </Section>
          {vatRegistered ? (
            <View style={styles.section}>
              <SwitchRow label={t('purchases.withVat')} hint={t('purchases.withVatHint')} value={withVat} onChange={setWithVat} testID="bill-with-vat" />
              {withVat ? (
                <MoneyInput label={t('purchases.vatAmount')} value={vat} onChange={setVatEdited} testID="bill-vat" />
              ) : null}
            </View>
          ) : null}
          <View style={styles.total}>
            <Text variant="h4" style={styles.flex}>
              {t('purchases.total')}
            </Text>
            <Text variant="h3" tabular testID="bill-total">
              {formatMoney(total)}
            </Text>
          </View>
          {owner ? (
            <View style={styles.section}>
              <SwitchRow label={t('purchases.paidNow')} hint={t('purchases.paidNowHint')} value={paidNow} onChange={setPaidNow} testID="bill-paid-now" />
              {paidNow ? (
                <>
                  <SegmentTabs<PayMethod>
                    items={(['cash', 'card', 'bank'] as const).map((m) => ({ key: m, label: t(`expenses.methods.${m}`) }))}
                    value={method}
                    onChange={setMethod}
                    testID="bill-pay-method"
                  />
                  <MoneyInput label={t('purchases.amountPaid')} value={paidAmount ?? total} onChange={setPaidAmount} testID="bill-paid-amount" />
                </>
              ) : null}
            </View>
          ) : (
            <Text variant="small" color="textSecondary">
              {t('purchases.ownerPays')}
            </Text>
          )}
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
  total: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
