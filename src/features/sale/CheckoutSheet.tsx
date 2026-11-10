import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ApprovalPanel } from '@/features/approvals/ApprovalSheet';
import { isApprovalNeeded, type ApprovalRequest } from '@/features/approvals/api';
import { useWorkspace } from '@/features/auth/session';
import { useCatalog } from '@/features/catalog/api';
import { recipeText } from '@/features/catalog/recipeText';
import { CustomerPicker, type PickedCustomer } from '@/features/customers/CustomerPicker';
import { useTerms } from '@/features/mode/useTerms';
import { useEmployees } from '@/features/queue/api';
import { useCreateSale, type PaymentMethod, type SaleResult } from '@/features/sales/api';
import { useTax } from '@/features/tax/useTax';
import { formatMoney, sum, type Minor } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing, useTheme } from '@/theme';
import { BottomSheet, Button, Card, Chip, FormError, Icon, MoneyInput, SegmentTabs, Text, TextField } from '@/ui';

import { basketTotals, type BasketLine } from './basket';
import { CheckoutLines } from './CheckoutLines';
import { CheckoutTotals } from './CheckoutTotals';
import { useCheckoutLimits, type CheckoutApprovals } from './useCheckoutLimits';

type Method = PaymentMethod | 'split';
const METHODS: Method[] = ['cash', 'card', 'wallet', 'split'];

export interface CheckoutProps {
  lines: BasketLine[];
  onQtyChange: (key: string, qty: number) => void;
  /** A service's price changed at checkout (logins that may, brief B2). */
  onPriceChange?: (key: string, price: Minor) => void;
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
}

/** Phones: checkout in a sheet over Quick sale. */
export function CheckoutSheet({ open, onClose, ...props }: CheckoutProps & { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t('sale.checkout')} snapPoints={['92%']}>
      <CheckoutForm {...props} />
    </BottomSheet>
  );
}

/** Customer, staff, the lines, discount and tip, payment and totals, and Save (the sheet, or the side panel). */
export function CheckoutForm(props: CheckoutProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const terms = useTerms();
  const { business, branch, role, employeeId: me } = useWorkspace();
  const tax = useTax();
  const employees = useEmployees(branch.id);
  // A staff member sells in their own name only (owner, 2026-10-19; the server makes sure of it too).
  const choosable = (employees.data ?? []).filter((e) => role !== 'staff' || e.id === me);
  const catalog = useCatalog(business.id);
  const create = useCreateSale(business.id, branch.id);

  const [discount, setDiscount] = useState<Minor | null>(null);
  const [tip, setTip] = useState<Minor | null>(null);
  const [method, setMethod] = useState<Method>('cash');
  const [split, setSplit] = useState<Record<PaymentMethod, Minor | null>>({ cash: null, card: null, wallet: null });
  // One reference per sale: a double tap or a retry after a timeout returns the same sale.
  // A fresh one is drawn only after a sale is saved.
  const [clientRef, setClientRef] = useState(() => Crypto.randomUUID());
  // Above the limits (brief B2): a manager gives a reason; the front desk and stylists a manager's or the owner's PIN.
  const [discountReason, setDiscountReason] = useState('');
  const [priceReason, setPriceReason] = useState('');
  const [approvals, setApprovals] = useState<CheckoutApprovals>({});
  const [asking, setAsking] = useState<ApprovalRequest | null>(null);

  const totals = basketTotals(props.lines, {
    tax: tax.rule,
    discount,
    tip,
    deposit: props.deposit,
  });
  const limits = useCheckoutLimits(props.lines, totals.discount, totals.subtotal);
  const { needDiscountReason, needPriceReason } = limits;
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
    if (line.kind === 'retail') {
      const prev = usage.get(line.name);
      usage.set(line.name, { qty: (prev?.qty ?? 0) + line.qty, unit: line.unit ?? 'pcs' });
      continue;
    }
    const service = catalog.data?.services.find((s) => s.id === line.serviceId);
    for (const r of service?.recipe ?? []) {
      const prev = usage.get(r.name);
      usage.set(r.name, { qty: (prev?.qty ?? 0) + r.qty * line.qty, unit: r.unit });
    }
  }
  const stock = recipeText([...usage.entries()].map(([name, u]) => ({ name, ...u })), t, ', ');

  const save = (have: CheckoutApprovals = approvals) => {
    const missing = limits.pinsNeeded(have)[0];
    if (missing) {
      setAsking(missing);
      return;
    }
    create.mutate(
      {
        client_ref: clientRef,
        appointment_id: props.appointmentId,
        customer_id: props.customer?.id ?? null,
        employee_id: props.employeeId,
        approvals: { discount: have.discount?.id, price_change: have.price_change?.id },
        discount_reason: needDiscountReason ? discountReason.trim() : undefined,
        price_reason: needPriceReason ? priceReason.trim() : undefined,
        lines: props.lines.map((l) =>
          l.kind === 'service'
            ? { kind: 'service', service_id: l.serviceId, qty: l.qty, ...(l.priceChanged ? { price_minor: l.unitPriceMinor } : {}) }
            : l.kind === 'retail'
              ? { kind: 'retail', item_id: l.itemId, qty: l.qty }
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
          setDiscountReason('');
          setPriceReason('');
          setApprovals({});
          props.onSaved(result, totals.due === 0 ? 'deposit' : method);
        },
        // The limits changed meanwhile: read them again; the next Save asks for what is needed now.
        onError: (error) => {
          if (isApprovalNeeded(error)) {
            setApprovals({});
            void limits.controls.refetch();
          }
        },
      },
    );
  };

  return (
    <>
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
          {choosable.map((person) => (
            <Chip
              key={person.id}
              label={person.full_name}
              selected={person.id === props.employeeId || role === 'staff'}
              onPress={() => {
                if (role !== 'staff') props.onEmployee(person.id === props.employeeId ? null : person.id);
              }}
              testID={`checkout-staff-${person.full_name}`}
            />
          ))}
        </View>
      </View>
      <CheckoutLines
        lines={props.lines}
        onQtyChange={props.onQtyChange}
        onPriceChange={props.onPriceChange}
        canChangePrice={can(role, 'changePrice')}
        listPrice={limits.listPrice}
      />
      {needPriceReason ? (
        <TextField label={t('sale.priceReason')} hint={t('sale.reasonKept')} value={priceReason} onChangeText={setPriceReason} maxLength={200} testID="price-reason" />
      ) : null}
      <View style={styles.pair}>
        <View style={styles.flex}>
          <MoneyInput
            label={t('sale.discount')}
            value={discount}
            onChange={setDiscount}
            hint={limits.discountNeedsPin ? t('sale.discountNeedsPin', { limit: limits.limit }) : undefined}
            testID="discount"
          />
        </View>
        <View style={styles.flex}>
          <MoneyInput
            label={t('sale.tip')}
            hint={t('sale.tipHint', { staff: terms.staff.toLocaleLowerCase() })}
            value={tip}
            onChange={setTip}
            testID="tip"
          />
        </View>
      </View>
      {needDiscountReason ? (
        <TextField
          label={t('sale.discountReason', { limit: limits.limit })}
          hint={t('sale.reasonKept')}
          value={discountReason}
          onChangeText={setDiscountReason}
          maxLength={200}
          testID="discount-reason"
        />
      ) : null}
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
      <CheckoutTotals totals={totals} />
      <Card variant="tinted" style={styles.note}>
        <Icon name="alert" size={18} color={theme.colors.primary500} />
        <Text variant="small" color="textOnTint" style={styles.flex}>
          {staff
            ? t('sale.willUpdateStaff', { staff: staff.full_name, stock: stock || t('sale.noStock') })
            : t('sale.willUpdate', { stock: stock || t('sale.noStock') })}
        </Text>
      </Card>
      {asking ? (
        <ApprovalPanel
          request={asking}
          onBack={() => setAsking(null)}
          onApproved={(approved) => {
            const have = { ...approvals, [asking.action]: { ...approved, amount: asking.amount ?? 0 } };
            setApprovals(have);
            setAsking(null);
            save(have);
          }}
        />
      ) : (
        <>
          <FormError error={create.error} />
          <Button
            label={t('sale.save', { amount: formatMoney(totals.due) })}
            disabled={!props.lines.length || !paymentOk || !limits.reasonsOk(discountReason, priceReason)}
            loading={create.isPending}
            onPress={() => save()}
            testID="save-sale"
          />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pair: { flexDirection: 'row', gap: spacing.md },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
