import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useCatalog } from '@/features/catalog/api';
import { recipeText } from '@/features/catalog/recipeText';
import { CustomerPicker, type PickedCustomer } from '@/features/customers/CustomerPicker';
import { useTerms } from '@/features/mode/useTerms';
import { useEmployees } from '@/features/queue/api';
import { useCreateSale, type PaymentMethod, type SaleResult } from '@/features/sales/api';
import { formatMoney, sum, type Minor } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { BottomSheet, Button, Card, Chip, FormError, Icon, MoneyInput, SegmentTabs, Stepper, Text } from '@/ui';

import { basketTotals, type BasketLine } from './basket';

type Method = PaymentMethod | 'split';
const METHODS: Method[] = ['cash', 'card', 'wallet', 'split'];

export function CheckoutSheet(props: {
  open: boolean;
  onClose: () => void;
  lines: BasketLine[];
  onQtyChange: (key: string, qty: number) => void;
  customer: PickedCustomer | null;
  onCustomer: (c: PickedCustomer | null) => void;
  guestName: string;
  onGuestName: (name: string) => void;
  employeeId: string | null;
  onEmployee: (id: string | null) => void;
  appointmentId: string | null;
  deposit: Minor;
  /** method is 'deposit' when the held deposit covered the whole bill. */
  onSaved: (result: SaleResult, method: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const terms = useTerms();
  const { business, branch } = useWorkspace();
  const employees = useEmployees(branch.id);
  const catalog = useCatalog(business.id);
  const create = useCreateSale(business.id, branch.id);

  const [discount, setDiscount] = useState<Minor | null>(null);
  const [tip, setTip] = useState<Minor | null>(null);
  const [method, setMethod] = useState<Method>('cash');
  const [split, setSplit] = useState<Record<PaymentMethod, Minor | null>>({ cash: null, card: null, wallet: null });
  // One reference per sale: a double tap or a retry after a timeout returns the same sale.
  // A fresh one is drawn only after a sale is saved.
  const [clientRef, setClientRef] = useState(() => Crypto.randomUUID());

  const totals = basketTotals(props.lines, {
    vatOn: branch.vat_mode === 'on',
    discount,
    tip,
    deposit: props.deposit,
  });
  const splitPaid = sum(Object.values(split).map((v) => v ?? 0));
  const payments =
    totals.due === 0
      ? []
      : method === 'split'
        ? (Object.entries(split) as [PaymentMethod, Minor | null][])
            .filter(([, v]) => (v ?? 0) > 0)
            .map(([m, v]) => ({ method: m, amount_minor: v! }))
        : [{ method, amount_minor: totals.due }];
  const paymentOk = method !== 'split' || totals.due === 0 || splitPaid === totals.due;

  const staff = (employees.data ?? []).find((e) => e.id === props.employeeId);
  const usage = new Map<string, { qty: number; unit: string }>();
  for (const line of props.lines) {
    const service = catalog.data?.services.find((s) => s.id === line.serviceId);
    for (const r of service?.recipe ?? []) {
      const prev = usage.get(r.name);
      usage.set(r.name, { qty: (prev?.qty ?? 0) + r.qty * line.qty, unit: r.unit });
    }
  }
  const stock = recipeText([...usage.entries()].map(([name, u]) => ({ name, ...u })), t, ', ');

  const save = () =>
    create.mutate(
      {
        client_ref: clientRef,
        appointment_id: props.appointmentId,
        customer_id: props.customer?.id ?? null,
        employee_id: props.employeeId,
        lines: props.lines.map((l) =>
          l.kind === 'service'
            ? { kind: 'service', service_id: l.serviceId, qty: l.qty }
            : { kind: 'custom', name: l.name, unit_price_minor: l.unitPriceMinor, qty: l.qty },
        ),
        discount_minor: totals.discount,
        tip_minor: totals.tip,
        payments,
      },
      {
        onSuccess: (result) => {
          setClientRef(Crypto.randomUUID());
          setDiscount(null);
          setTip(null);
          setSplit({ cash: null, card: null, wallet: null });
          props.onSaved(result, totals.due === 0 ? 'deposit' : method);
        },
      },
    );

  const row = (label: string, value: string, strong = false, testID?: string) => (
    <View style={styles.totalRow}>
      <Text variant={strong ? 'h4' : 'body'} color={strong ? 'text' : 'textSecondary'} style={styles.flex}>
        {label}
      </Text>
      <Text variant={strong ? 'h3' : 'bodyStrong'} weight={strong ? 'bold' : 'medium'} tabular testID={testID}>
        {value}
      </Text>
    </View>
  );

  return (
    <BottomSheet open={props.open} onClose={props.onClose} title={t('sale.checkout')} snapPoints={['92%']}>
      <View style={styles.section}>
        <Text variant="bodyStrong">{t('sale.customer')}</Text>
        <CustomerPicker
          value={props.customer}
          onChange={props.onCustomer}
          guestName={props.guestName}
          onGuestName={props.onGuestName}
        />
      </View>
      <View style={styles.section}>
        <Text variant="bodyStrong">{terms.staff}</Text>
        <View style={styles.wrap}>
          {(employees.data ?? []).map((person) => (
            <Chip
              key={person.id}
              label={person.full_name}
              selected={person.id === props.employeeId}
              onPress={() => props.onEmployee(person.id === props.employeeId ? null : person.id)}
              testID={`checkout-staff-${person.full_name}`}
            />
          ))}
        </View>
      </View>
      <Card variant="outlined" style={styles.section}>
        {props.lines.map((line) => (
          <View key={line.key} style={styles.line}>
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {line.name}
              </Text>
              <Text variant="small" color="textSecondary" tabular>
                {formatMoney(line.unitPriceMinor * line.qty)}
              </Text>
            </View>
            <Stepper value={line.qty} onChange={(n) => props.onQtyChange(line.key, n)} itemLabel={line.name} showAddAtZero={false} />
          </View>
        ))}
      </Card>
      <View style={styles.pair}>
        <View style={styles.flex}>
          <MoneyInput label={t('sale.discount')} value={discount} onChange={setDiscount} testID="discount" />
        </View>
        <View style={styles.flex}>
          <MoneyInput label={t('sale.tip')} value={tip} onChange={setTip} testID="tip" />
        </View>
      </View>
      {totals.due > 0 ? (
        <View style={styles.section}>
          <Text variant="bodyStrong">{t('sale.payment')}</Text>
          <SegmentTabs<Method>
            items={METHODS.map((key) => ({ key, label: t(`sale.methods.${key}`) }))}
            value={method}
            onChange={setMethod}
            testID="pay"
          />
          {method === 'split' ? (
            <>
              {(['cash', 'card', 'wallet'] as const).map((m) => (
                <MoneyInput
                  key={m}
                  label={t(`sale.methods.${m}`)}
                  value={split[m]}
                  onChange={(v) => setSplit((s) => ({ ...s, [m]: v }))}
                  testID={`split-${m}`}
                />
              ))}
              <Text variant="small" color={paymentOk ? 'textSecondary' : 'primaryText'} testID="split-remaining">
                {t('sale.splitRemaining', { amount: formatMoney(totals.due - splitPaid) })}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}
      <View style={styles.totals}>
        {row(t('sale.subtotal'), formatMoney(totals.subtotal))}
        {totals.discount ? row(t('sale.discount'), formatMoney(-totals.discount)) : null}
        {row(
          t('sale.vat'),
          branch.vat_mode === 'on' ? t('sale.vatIncluded', { amount: formatMoney(totals.vat) }) : t('sale.vatNotApplied'),
          false,
          'checkout-vat',
        )}
        {totals.tip ? row(t('sale.tip'), formatMoney(totals.tip)) : null}
        {totals.depositApplied ? row(t('sale.depositApplied'), formatMoney(-totals.depositApplied)) : null}
        {row(t('sale.amountDue'), formatMoney(totals.due), true, 'checkout-due')}
      </View>
      <Card variant="tinted" style={styles.note}>
        <Icon name="alert" size={18} color={theme.colors.primary500} />
        <Text variant="small" color="textOnTint" style={styles.flex}>
          {staff
            ? t('sale.willUpdateStaff', { staff: staff.full_name, stock: stock || t('sale.noStock') })
            : t('sale.willUpdate', { stock: stock || t('sale.noStock') })}
        </Text>
      </Card>
      <FormError error={create.error} />
      <Button
        label={t('sale.save', { amount: formatMoney(totals.due) })}
        disabled={!props.lines.length || !paymentOk}
        loading={create.isPending}
        onPress={save}
        testID="save-sale"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pair: { flexDirection: 'row', gap: spacing.md },
  totals: { gap: spacing.xs },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
