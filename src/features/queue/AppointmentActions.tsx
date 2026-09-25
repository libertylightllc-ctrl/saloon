import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { BottomSheet, Button, FormError, Text, TextField, useToast } from '@/ui';

import { useQueueAction, type Appointment } from './api';

/** The "…" menu on a queue row: the less common actions, each doing its real job. */
export function AppointmentActions({ item, onClose }: { item: Appointment | null; onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { branch, role, rules } = useWorkspace();
  const action = useQueueAction(branch.id);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  const close = () => {
    setCancelling(false);
    setReason('');
    action.reset();
    onClose();
  };
  const open = item !== null;
  const active = item && ['booked', 'waiting'].includes(item.status);
  const cutoff = Number((branch.settings as Record<string, unknown>).cancel_cutoff_hours ?? 12);
  const name = item?.customer_name ?? t('queue.guest');

  const run = (kind: 'start' | 'noShow' | 'cancel') => {
    if (!item) return;
    action.mutate(
      { action: kind, id: item.id, reason },
      {
        onSuccess: (result) => {
          const outcome = kind === 'cancel' && (result === 'refund' || result === 'forfeit') ? result : null;
          toast(outcome ? t(`queue.toast.cancel_${outcome}`, { name }) : t(`queue.toast.${kind}`, { name }));
          close();
        },
      },
    );
  };

  return (
    <BottomSheet open={open} onClose={close} title={name}>
      {item?.deposit_status === 'held' ? (
        <Text variant="small" color="textSecondary">
          {t('queue.depositRule', { amount: formatMoney(item.deposit_minor), hours: cutoff })}
        </Text>
      ) : null}
      {cancelling ? (
        <View style={styles.stack}>
          <TextField
            label={t('queue.cancelReason')}
            value={reason}
            onChangeText={setReason}
            autoFocus
            testID="cancel-reason"
          />
          <FormError error={action.error} />
          <Button
            label={t('queue.confirmCancel')}
            variant="danger"
            loading={action.isPending}
            disabled={reason.trim().length < 3}
            onPress={() => run('cancel')}
            testID="confirm-cancel"
          />
        </View>
      ) : (
        <View style={styles.stack}>
          <FormError error={action.error} />
          {item?.status === 'booked' ? (
            <Button label={t('queue.actions.start')} variant="secondary" loading={action.isPending} onPress={() => run('start')} />
          ) : null}
          {item?.status === 'in_progress' && can(role, 'sell', rules) ? (
            <Button
              label={t('queue.actions.complete')}
              onPress={() => {
                close();
                router.push({ pathname: '/sale', params: { appointment: item.id } });
              }}
            />
          ) : null}
          {active && can(role, 'noShowOrCancel') ? (
            <>
              <Button
                label={t('queue.actions.noShow')}
                variant="outline"
                loading={action.isPending}
                onPress={() => run('noShow')}
                testID="action-no-show"
              />
              <Button
                label={t('queue.actions.cancel')}
                variant="ghost"
                onPress={() => setCancelling(true)}
                testID="action-cancel"
              />
            </>
          ) : null}
          {item?.sale_id && can(role, 'viewSales') ? (
            <Button
              label={t('queue.viewSale')}
              variant="secondary"
              onPress={() => {
                close();
                router.push({ pathname: '/sales/[id]', params: { id: item.sale_id! } });
              }}
            />
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ stack: { gap: spacing.md } });
