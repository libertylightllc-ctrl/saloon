import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useTerms } from '@/features/mode/useTerms';
import { formatMoney, subtract, sum, vatFromInclusive, type Minor } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  Chip,
  Icon,
  MoneyInput,
  SegmentTabs,
  Stepper,
  SuccessCheck,
  Text,
  useToast,
} from '@/ui';

import type { DemoService } from './data';
import { useDemoBranch } from './useDemo';

export type Method = 'cash' | 'card' | 'wallet' | 'split';

export interface SavedSale {
  number: number;
  totalMinor: Minor;
  method: Method;
}

export interface CheckoutLine {
  service: DemoService;
  qty: number;
  totalMinor: Minor;
}

const VAT_BPS = 500;

export function CheckoutSheet({
  open,
  onClose,
  lines,
  onQtyChange,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  lines: CheckoutLine[];
  onQtyChange: (serviceId: string, qty: number) => void;
  onSaved: (totalMinor: Minor, method: Method) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const terms = useTerms();
  const toast = useToast();
  const demo = useDemoBranch();
  const [staffId, setStaffId] = useState(demo.staff[0]?.id ?? '');
  const [method, setMethod] = useState<Method>('cash');
  const [discount, setDiscount] = useState<Minor | null>(null);
  const [tip, setTip] = useState<Minor | null>(null);

  const staff = demo.staff.find((s) => s.id === staffId) ?? demo.staff[0];
  const subtotal = sum(lines.map((l) => l.totalMinor));
  const due = Math.max(0, subtract(subtotal, discount ?? 0)) + (tip ?? 0);
  const vat = demo.vatOn ? vatFromInclusive(subtract(subtotal, discount ?? 0), VAT_BPS) : null;
  const stock = lines
    .map((l) => l.service.stock)
    .filter(Boolean)
    .join(', ');

  const row = (label: string, value: string, strong?: boolean) => (
    <View style={styles.totalRow}>
      <Text
        variant={strong ? 'h4' : 'body'}
        color={strong ? 'text' : 'textSecondary'}
        style={styles.flex}
      >
        {label}
      </Text>
      <Text variant={strong ? 'h3' : 'bodyStrong'} weight={strong ? 'bold' : 'medium'} tabular>
        {value}
      </Text>
    </View>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={t('sale.checkout')} snapPoints={['92%']}>
      <View style={styles.section}>
        <Text variant="bodyStrong">{t('sale.customer')}</Text>
        <View style={styles.wrap}>
          <Chip label={t('sale.guest')} icon="user" selected />
          <Chip label={t('sale.findCustomer')} icon="search" />
          <Chip label={t('sale.newCustomer')} icon="userPlus" />
        </View>
      </View>
      <View style={styles.section}>
        <Text variant="bodyStrong">{terms.staff}</Text>
        <View style={styles.wrap}>
          {demo.staff.map((person) => (
            <Chip
              key={person.id}
              label={person.name}
              selected={person.id === staffId}
              onPress={() => setStaffId(person.id)}
            />
          ))}
        </View>
      </View>
      <Card variant="outlined" style={styles.section}>
        {lines.map((line) => (
          <View key={line.service.id} style={styles.line}>
            <Avatar name={staff?.name ?? ''} color={staff?.colour} size={28} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {line.service.name}
              </Text>
              <Text variant="small" color="textSecondary" tabular>
                {formatMoney(line.totalMinor)}
              </Text>
            </View>
            <Stepper
              value={line.qty}
              onChange={(n) => onQtyChange(line.service.id, n)}
              itemLabel={line.service.name}
              showAddAtZero={false}
            />
          </View>
        ))}
      </Card>
      <View style={styles.pair}>
        <View style={styles.flex}>
          <MoneyInput label={t('sale.discount')} value={discount} onChange={setDiscount} />
        </View>
        <View style={styles.flex}>
          <MoneyInput label={t('sale.tip')} value={tip} onChange={setTip} />
        </View>
      </View>
      <View style={styles.section}>
        <Text variant="bodyStrong">{t('sale.payment')}</Text>
        <SegmentTabs<Method>
          items={(['cash', 'card', 'wallet', 'split'] as const).map((key) => ({
            key,
            label: t(`sale.methods.${key}`),
          }))}
          value={method}
          onChange={setMethod}
        />
      </View>
      <View style={styles.totals}>
        {row(t('sale.subtotal'), formatMoney(subtotal))}
        {discount ? row(t('sale.discount'), formatMoney(-discount)) : null}
        {tip ? row(t('sale.tip'), formatMoney(tip)) : null}
        {row(
          t('sale.vat'),
          vat === null
            ? t('sale.vatNotApplied')
            : t('sale.vatIncluded', { amount: formatMoney(vat) }),
        )}
        {row(t('sale.amountDue'), formatMoney(due), true)}
      </View>
      <Card variant="tinted" style={styles.note}>
        <Icon name="alert" size={18} color={theme.colors.primary500} />
        <Text variant="small" color="textOnTint" style={styles.flex}>
          {t('sale.willUpdate', { staff: staff?.name ?? '', stock })}
        </Text>
      </Card>
      <Button
        label={t('sale.save', { amount: formatMoney(due) })}
        disabled={!lines.length}
        onPress={() => {
          toast(t('sale.saved'));
          setDiscount(null);
          setTip(null);
          onSaved(due, method);
        }}
      />
    </BottomSheet>
  );
}

export function SaleDoneSheet({ sale, onClose }: { sale: SavedSale | null; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <BottomSheet open={sale !== null} onClose={onClose}>
      {sale ? (
        <View style={styles.done}>
          <SuccessCheck />
          <Text variant="h3" align="center">
            {t('sale.doneTitle', { number: `#${sale.number}` })}
          </Text>
          <Text variant="display" align="center" tabular>
            {formatMoney(sale.totalMinor)}
          </Text>
          <Text align="center" color="textSecondary">
            {`${t('sale.paidWith', { method: t(`sale.methods.${sale.method}`) })} · ${t('sale.doneBody')}`}
          </Text>
        </View>
      ) : null}
      <Button
        label={t('sale.shareReceipt')}
        icon="share"
        variant="secondary"
        onPress={() => toast(t('dev.laterPhase'), 'info')}
      />
      <Button
        label={t('sale.print')}
        icon="printer"
        variant="outline"
        onPress={() => toast(t('dev.laterPhase'), 'info')}
      />
      <Button label={t('sale.newSale')} onPress={onClose} />
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
  done: { alignItems: 'center', gap: spacing.sm },
});
