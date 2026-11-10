import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { qtyText } from '@/features/inventory/labels';
import { useSuppliers } from '@/features/moneyout/api';
import { purchaseNo } from '@/features/moneyout/labels';
import { SummaryRow } from '@/features/moneyout/SummaryRow';
import { SupplierSheet } from '@/features/moneyout/SupplierSheet';
import { businessDate, shiftBusinessDate } from '@/lib/dates';
import { formatMoney, multiply, sum, vatOnTop, type Minor } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, Card, Chip, DateStrip, FormError, MoneyInput, QueryState, SwitchRow, Text, TextField, useToast } from '@/ui';

import { supplierOf, usePriceDelivery, type Delivery } from './api';

interface Price {
  price: Minor | null;
  vat: Minor | null;
}

/**
 * Adding the prices from the supplier's invoice (owner, manager, accountant): price per pack and its VAT for each
 * line as received. Saving makes it the supplier bill (unpaid; paid from the bill) and puts the delivery in stock.
 */
export function PriceForm({ delivery }: { delivery: Delivery }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const suppliers = useSuppliers(business.id, false);
  const price = usePriceDelivery(business.id, branch.id);
  const today = businessDate(new Date(), business.timezone);
  const [supplierId, setSupplierId] = useState<string | null>(delivery.supplier_id);
  const [adding, setAdding] = useState(false);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [date, setDate] = useState(delivery.business_date);
  const [withVat, setWithVat] = useState(true);
  const [prices, setPrices] = useState<Record<string, Price>>({});
  const rate = branch.tax_rate_bps;
  const vatRecoverable = branch.vat_mode === 'on';

  const net = (id: string, packs: number) => {
    const p = prices[id]?.price;
    return p == null ? 0 : multiply(p, packs);
  };
  const vatOf = (id: string, packs: number) => (withVat ? (prices[id]?.vat ?? vatOnTop(net(id, packs), rate)) : 0);
  const lines = delivery.delivery_lines;
  const subtotal = sum(lines.map((l) => net(l.id, l.packs)));
  const vat = sum(lines.map((l) => vatOf(l.id, l.packs)));
  const ready =
    Boolean(supplierId) &&
    lines.every((l) => prices[l.id]?.price != null && vatOf(l.id, l.packs) <= net(l.id, l.packs)) &&
    subtotal > 0;
  // The bill date: the invoice's date, from the last two weeks (and the day it arrived), never after today.
  const recent = Array.from({ length: 14 }, (_, i) => shiftBusinessDate(today, i - 13));
  const days = recent.includes(delivery.business_date) ? recent : [delivery.business_date, ...recent];

  const save = () =>
    price.mutate(
      {
        delivery_id: delivery.id,
        supplier_id: supplierId!,
        invoice_ref: invoiceRef.trim() || null,
        bill_date: date,
        lines: lines.map((l) => ({ line_id: l.id, unit_price_minor: prices[l.id]!.price!, vat_minor: vatOf(l.id, l.packs) })),
      },
      {
        onSuccess: (r) => {
          toast(t('deliveries.priced', { number: purchaseNo(r.number) }));
          router.replace({ pathname: '/purchases/[id]', params: { id: r.bill_id } });
        },
      },
    );

  return (
    <View style={styles.body}>
      <Text variant="h4">{t('deliveries.addPrices')}</Text>
      <Text variant="small" color="textSecondary">
        {t('deliveries.addPricesHint')}
      </Text>
      <View style={styles.section}>
        <Text variant="bodyStrong">{t('purchases.supplier')}</Text>
        {!delivery.supplier_id && supplierOf(delivery) ? (
          <Text variant="small" color="textSecondary">
            {t('deliveries.namedAtDoor', { name: supplierOf(delivery) })}
          </Text>
        ) : null}
        <QueryState query={suppliers}>
          {(rows) => (
            <View style={styles.wrap}>
              {rows.map((s) => (
                <Chip key={s.id} label={s.name} selected={supplierId === s.id} onPress={() => setSupplierId(s.id)} testID={`price-supplier-${s.name}`} />
              ))}
              <Chip icon="plus" label={t('purchases.newSupplier')} onPress={() => setAdding(true)} testID="price-supplier-new" />
            </View>
          )}
        </QueryState>
      </View>
      <TextField label={t('purchases.invoiceRef')} value={invoiceRef} onChangeText={setInvoiceRef} maxLength={40} testID="price-invoice" />
      <View style={styles.section}>
        <Text variant="bodyStrong">{t('purchases.billDate')}</Text>
        <DateStrip dates={days} value={date} onChange={setDate} />
      </View>
      <SwitchRow
        label={t('purchases.withVat')}
        hint={t(vatRecoverable ? 'purchases.withVatHint' : 'purchases.withVatCostHint')}
        value={withVat}
        onChange={setWithVat}
        testID="price-with-vat"
      />
      {lines.map((l, i) => {
        const unit = l.inventory_items?.unit ?? 'pcs';
        const lineNet = net(l.id, l.packs);
        const lineVat = vatOf(l.id, l.packs);
        return (
          <Card key={l.id} variant="outlined" padding={spacing.md} style={styles.card} testID={`price-line-${i}`}>
            <Text variant="bodyStrong">{l.inventory_items?.name ?? '—'}</Text>
            <Text variant="small" color="textSecondary">
              {t('deliveries.lineQty', { count: Number(l.packs), qty: qtyText(l.packs * Number(l.pack_size ?? 1), unit, t) })}
            </Text>
            <View style={styles.row}>
              <View style={styles.flex}>
                <MoneyInput
                  label={t('purchases.unitPrice')}
                  value={prices[l.id]?.price ?? null}
                  onChange={(p) => setPrices({ ...prices, [l.id]: { price: p, vat: null } })}
                  testID={`price-line-price-${i}`}
                />
              </View>
              {withVat ? (
                <View style={styles.flex}>
                  <MoneyInput
                    label={t('purchases.lineVat')}
                    value={lineVat}
                    onChange={(v) => setPrices({ ...prices, [l.id]: { price: prices[l.id]?.price ?? null, vat: v } })}
                    error={lineVat > lineNet ? t('purchases.vatTooMuch') : undefined}
                    testID={`price-line-vat-${i}`}
                  />
                </View>
              ) : null}
            </View>
            <SummaryRow label={t(withVat ? 'purchases.lineTotalVat' : 'purchases.lineTotal')} value={formatMoney(lineNet + lineVat)} />
          </Card>
        );
      })}
      <Card variant="outlined" style={styles.card} testID="price-summary">
        <SummaryRow label={t('purchases.subtotal')} value={formatMoney(subtotal)} />
        {withVat ? <SummaryRow label={t('purchases.vatTotal')} value={formatMoney(vat)} /> : null}
        <SummaryRow label={t('purchases.grandTotal')} value={formatMoney(subtotal + vat)} strong testID="price-total" />
      </Card>
      <Text variant="small" color="textSecondary">
        {t('deliveries.afterPricing')}
      </Text>
      <FormError error={price.error} />
      <Button label={t('deliveries.savePrices', { amount: formatMoney(subtotal + vat) })} onPress={save} disabled={!ready} loading={price.isPending} testID="price-save" />
      <SupplierSheet
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(id) => {
          setSupplierId(id);
          setAdding(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  section: { gap: spacing.sm },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
