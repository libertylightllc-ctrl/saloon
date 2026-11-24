import type { UseMutationResult } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Button, TextField, useToast } from '@/ui';

type Approve = UseMutationResult<void, Error, { runId: string; reason?: string }>;

/**
 * Approve the month's payroll. Before the month's last day the owner approves early only with a reason (owner's brief
 * A10): sales, attendance and leave after today would not be in it. The server checks the same.
 */
export function ApprovePayroll({ runId, early, disabled, approve }: { runId: string; early: boolean; disabled: boolean; approve: Approve }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const done = () => {
    setAsking(false);
    setReason('');
    toast(t('payroll.approved'));
  };

  if (!early) {
    return (
      <Button
        label={t('payroll.approve')}
        size="md"
        disabled={disabled}
        loading={approve.isPending}
        onPress={() => approve.mutate({ runId }, { onSuccess: done })}
        testID="payroll-approve"
      />
    );
  }
  if (!asking) {
    return <Button label={t('payroll.early.approve')} size="md" variant="outline" disabled={disabled} onPress={() => setAsking(true)} testID="payroll-approve-early" />;
  }
  return (
    <View style={styles.ask}>
      <TextField label={t('payroll.early.reason')} value={reason} onChangeText={setReason} testID="payroll-early-reason" />
      <View style={styles.row}>
        <Button
          label={t('payroll.early.confirm')}
          size="md"
          disabled={disabled || reason.trim().length < 3}
          loading={approve.isPending}
          onPress={() => approve.mutate({ runId, reason: reason.trim() }, { onSuccess: done })}
          testID="payroll-approve"
        />
        <Button label={t('common.cancel')} size="md" variant="ghost" onPress={() => setAsking(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ask: { gap: spacing.sm, flexBasis: '100%' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
