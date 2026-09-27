import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { BottomSheet, Button, Card, FormError, StatusPill, Text, TextField, useToast } from '@/ui';

import { useApproveClosing, useCounters, useReturnClosing, type Closing } from './api';
import { MoneyLine, VarianceChip } from './ExpectedCard';

/** A submitted or approved close: the figures, and for the owner Approve / Send back. */
export function CloseSummary({ closing }: { closing: Closing }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch, role } = useWorkspace();
  const counters = useCounters(business.id);
  const approve = useApproveClosing(branch.id, business.id);
  const [sendingBack, setSendingBack] = useState(false);
  const counter = counters.data?.find((m) => m.id === closing.counted_by)?.display_name;
  const pending = closing.status === 'pending_approval';

  return (
    <Card variant="outlined" style={styles.card}>
      <View style={styles.row}>
        <StatusPill status={closing.status === 'approved' ? 'approved' : 'pending_approval'} />
        <Text color="textSecondary" style={styles.flex}>
          {closing.status === 'approved' ? t('closing.locked') : t('closing.waiting')}
        </Text>
      </View>
      <MoneyLine label={t('closing.expected')} value={closing.expected_cash_minor ?? 0} />
      <MoneyLine label={t('closing.counted')} value={closing.counted_cash_minor ?? 0} strong testID="closing-summary-counted" />
      <VarianceChip counted={closing.counted_cash_minor ?? 0} expected={closing.expected_cash_minor ?? 0} />
      {closing.reason ? <Text color="textSecondary">{t('closing.reasonWas', { reason: closing.reason })}</Text> : null}
      {counter ? <Text color="textSecondary">{t('closing.countedByName', { name: counter })}</Text> : null}
      {closing.taken_out_minor > 0 ? (
        <MoneyLine label={t(`closing.takenOutTo.${closing.taken_out_to ?? 'bank'}`)} value={closing.taken_out_minor} />
      ) : null}
      {pending && can(role, 'approveClosing') ? (
        <>
          <FormError error={approve.error} />
          <View style={styles.actions}>
            <Button
              label={t('closing.sendBack')}
              variant="outline"
              size="md"
              onPress={() => setSendingBack(true)}
              testID="closing-send-back"
            />
            <Button
              label={t('closing.approve')}
              size="md"
              loading={approve.isPending}
              onPress={() => approve.mutate(closing.id, { onSuccess: () => toast(t('closing.done.approve')) })}
              testID="closing-approve"
            />
          </View>
        </>
      ) : null}
      <BottomSheet open={sendingBack} onClose={() => setSendingBack(false)} title={t('closing.sendBack')}>
        {sendingBack ? <SendBackForm closing={closing} onDone={() => setSendingBack(false)} /> : null}
      </BottomSheet>
    </Card>
  );
}

function SendBackForm({ closing, onDone }: { closing: Closing; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const back = useReturnClosing(branch.id, business.id);
  const [reason, setReason] = useState('');
  return (
    <>
      <Text color="textSecondary">{t('closing.sendBackHint')}</Text>
      <TextField label={t('closing.sendBackReason')} value={reason} onChangeText={setReason} maxLength={200} testID="closing-send-back-reason" />
      <FormError error={back.error} />
      <Button
        label={t('closing.sendBack')}
        disabled={reason.trim().length < 3}
        loading={back.isPending}
        onPress={() =>
          back.mutate(
            { id: closing.id, reason: reason.trim() },
            {
              onSuccess: () => {
                toast(t('closing.done.sentBack'));
                onDone();
              },
            },
          )
        }
        testID="closing-send-back-confirm"
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'flex-end' },
});
