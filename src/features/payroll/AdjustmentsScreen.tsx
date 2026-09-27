import * as Crypto from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useStaffDirectory } from '@/features/staff/api';
import { businessMonth, type MonthKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import {
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  FormError,
  HeaderBand,
  ListRow,
  MoneyInput,
  QueryState,
  Screen,
  SegmentTabs,
  StatusPill,
  Text,
  TextField,
  useToast,
} from '@/ui';

import { useAdjustments, useRecordAdjustment, useReverseAdjustment, type Adjustment, type AdjustmentKind } from './api';

/** Bonuses, deductions and advances for a month (owner). An advance is paid out straight away. */
export function AdjustmentsScreen() {
  const { t } = useTranslation();
  const dates = useDates();
  const params = useLocalSearchParams<{ month?: string }>();
  const { business } = useWorkspace();
  const month = (params.month as MonthKey | undefined) ?? businessMonth(new Date(), business.timezone);
  const list = useAdjustments(business.id, month);
  const [adding, setAdding] = useState(false);
  const [reversing, setReversing] = useState<Adjustment | null>(null);
  const thisMonth = month === businessMonth(new Date(), business.timezone);

  return (
    <>
      <Screen
        refreshing={list.isRefetching}
        onRefresh={() => void list.refetch()}
        header={
          <HeaderBand
            title={t('payroll.adjustments')}
            subtitle={dates.day(`${month}-01`, 'MMMM yyyy')}
            onBack
            right={thisMonth ? <Button label={t('common.new')} icon="plus" size="sm" variant="secondary" onPress={() => setAdding(true)} testID="adjustment-new" /> : undefined}
          />
        }
      >
        <QueryState query={list} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('payroll.noAdjustments')} />}>
          {(rows) => (
            <View style={styles.list}>
              {rows.map((a) => (
                <ListRow
                  key={a.id}
                  testID={`adjustment-${a.kind}-${a.employees?.full_name}`}
                  title={`${t(`payroll.kinds.${a.kind}`)} · ${a.employees?.full_name ?? ''}`}
                  meta={[
                    [dates.day(a.business_date, 'd MMM'), a.method ? t(`expenses.methods.${a.method}`) : null, a.note].filter(Boolean).join(' · '),
                    ...(a.reverse_reason ? [t('payroll.reversedBecause', { reason: a.reverse_reason })] : []),
                  ]}
                  badges={a.status === 'reversed' ? <StatusPill status="reversed" /> : undefined}
                  trailing={
                    <View style={styles.trailing}>
                      <Text variant="bodyStrong" tabular>
                        {a.kind === 'bonus' ? '+' : '−'}
                        {formatMoney(a.amount_minor)}
                      </Text>
                      {a.status === 'posted' && thisMonth ? (
                        <Button label={t('payroll.reverse')} size="sm" variant="ghost" onPress={() => setReversing(a)} testID={`adjustment-reverse-${a.id}`} />
                      ) : null}
                    </View>
                  }
                />
              ))}
            </View>
          )}
        </QueryState>
      </Screen>
      <BottomSheet open={adding} onClose={() => setAdding(false)} title={t('payroll.newAdjustment')}>
        {adding ? <NewAdjustment onDone={() => setAdding(false)} /> : null}
      </BottomSheet>
      <BottomSheet open={reversing !== null} onClose={() => setReversing(null)} title={t('payroll.reverse')}>
        {reversing ? <ReverseForm adjustment={reversing} onDone={() => setReversing(null)} /> : null}
      </BottomSheet>
    </>
  );
}

function NewAdjustment({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const staff = useStaffDirectory(business.id);
  const record = useRecordAdjustment(business.id, branch.id);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [kind, setKind] = useState<AdjustmentKind>('bonus');
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<'cash' | 'bank'>('cash');
  const [note, setNote] = useState('');
  const [clientRef] = useState(() => Crypto.randomUUID());
  const ready = Boolean(employeeId && amount && amount > 0);
  return (
    <>
      <View style={styles.chips}>
        {(staff.data ?? [])
          .filter((s) => s.active)
          .map((s) => (
            <Chip key={s.employee_id} label={s.full_name} selected={employeeId === s.employee_id} onPress={() => setEmployeeId(s.employee_id)} testID={`adjustment-person-${s.full_name}`} />
          ))}
      </View>
      <SegmentTabs<AdjustmentKind>
        items={(['bonus', 'deduction', 'advance'] as const).map((k) => ({ key: k, label: t(`payroll.kinds.${k}`) }))}
        value={kind}
        onChange={setKind}
        testID="adjustment-kind"
      />
      <MoneyInput label={t('payroll.amount')} value={amount} onChange={setAmount} testID="adjustment-amount" />
      {kind === 'advance' ? (
        <>
          <SegmentTabs<'cash' | 'bank'>
            items={(['cash', 'bank'] as const).map((m) => ({ key: m, label: t(`expenses.methods.${m}`) }))}
            value={method}
            onChange={setMethod}
            testID="adjustment-method"
          />
          <Text variant="small" color="textSecondary">
            {t('payroll.advanceHint')}
          </Text>
        </>
      ) : null}
      <TextField label={t('expenses.note')} value={note} onChangeText={setNote} maxLength={200} testID="adjustment-note" />
      <FormError error={record.error} />
      <Button
        label={t('common.save')}
        disabled={!ready}
        loading={record.isPending}
        onPress={() =>
          record.mutate(
            { employee_id: employeeId!, kind, amount_minor: amount!, method: kind === 'advance' ? method : undefined, note: note.trim() || null, client_ref: clientRef },
            {
              onSuccess: () => {
                toast(t('payroll.adjustmentSaved'));
                onDone();
              },
            },
          )
        }
        testID="adjustment-save"
      />
    </>
  );
}

function ReverseForm({ adjustment, onDone }: { adjustment: Adjustment; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const reverse = useReverseAdjustment(business.id, branch.id);
  const [reason, setReason] = useState('');
  return (
    <>
      <TextField label={t('expenses.reverseReason')} value={reason} onChangeText={setReason} maxLength={200} testID="adjustment-reverse-reason" />
      <FormError error={reverse.error} />
      <Button
        label={t('payroll.reverse')}
        variant="danger"
        disabled={reason.trim().length < 3}
        loading={reverse.isPending}
        onPress={() =>
          reverse.mutate(
            { id: adjustment.id, reason: reason.trim() },
            {
              onSuccess: () => {
                toast(t('payroll.adjustmentReversed'));
                onDone();
              },
            },
          )
        }
        testID="adjustment-reverse-confirm"
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  trailing: { alignItems: 'flex-end', gap: 2 },
});
