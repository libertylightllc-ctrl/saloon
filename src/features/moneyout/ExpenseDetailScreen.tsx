import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { BottomSheet, Button, Card, FormError, HeaderBand, QueryState, Screen, StatusPill, Text, TextField, useToast } from '@/ui';

import { useExpense, useReverseExpense } from './api';
import { useCategoryName } from './labels';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text color="textSecondary" style={styles.flex}>
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

/** One expense; the owner can reverse it with a reason (it stays on record, marked reversed). */
export function ExpenseDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const dates = useDates();
  const name = useCategoryName();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business, branch, role } = useWorkspace();
  const expense = useExpense(business.id, id);
  const reverse = useReverseExpense(business.id, branch.id);
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <>
      <Screen header={<HeaderBand title={t('expenses.detailTitle')} onBack />}>
        <QueryState query={expense}>
          {(e) => (
            <View style={styles.body}>
              <Card variant="outlined" style={styles.card}>
                <Text variant="display" tabular testID="expense-detail-amount">
                  {formatMoney(e.amount_minor)}
                </Text>
                {e.status === 'reversed' ? <StatusPill status="reversed" /> : null}
                <Row label={t('expenses.category')} value={name(e.expense_categories)} />
                <Row label={t('expenses.paidBy')} value={t(`expenses.methods.${e.method}`)} />
                <Row label={t('expenses.date')} value={dates.day(e.business_date, 'EEE d MMM yyyy')} />
                {e.note ? <Row label={t('expenses.note')} value={e.note} /> : null}
                {e.members ? <Row label={t('expenses.recordedBy')} value={e.members.display_name} /> : null}
                {e.reverse_reason ? <Row label={t('expenses.reverseReason')} value={e.reverse_reason} /> : null}
              </Card>
              {e.status === 'posted' && can(role, 'payOrReverseMoneyOut') ? (
                <Button label={t('expenses.reverse')} icon="rotate" variant="ghost" onPress={() => setReversing(true)} testID="expense-reverse" />
              ) : null}
            </View>
          )}
        </QueryState>
      </Screen>
      <BottomSheet open={reversing} onClose={() => setReversing(false)} title={t('expenses.reverse')}>
        <Text color="textSecondary">{t('expenses.reverseHint')}</Text>
        <TextField label={t('expenses.reverseReason')} value={reason} onChangeText={setReason} maxLength={200} testID="expense-reverse-reason" />
        <FormError error={reverse.error} />
        <Button
          label={t('expenses.reverse')}
          variant="danger"
          disabled={reason.trim().length < 3}
          loading={reverse.isPending}
          onPress={() =>
            reverse.mutate(
              { id: id!, reason: reason.trim() },
              {
                onSuccess: () => {
                  toast(t('expenses.reversed'));
                  setReversing(false);
                  router.back();
                },
              },
            )
          }
          testID="expense-reverse-confirm"
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
