import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useDismissRequest, useRefundRequest } from '@/features/notifications/api';
import { formatMoney } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, Card, StatusPill, Text, useToast } from '@/ui';

import type { SaleDetail } from './api';

/**
 * A refund request a front desk sent to the owner before refunds took a manager's PIN (Part B): the owner still sees an
 * open one on the sale and refunds or declines it. New requests are no longer sent; the front desk refunds with a PIN.
 */
export function RefundRequest({ sale }: { sale: SaleDetail }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { role } = useWorkspace();
  const request = useRefundRequest(sale.id);
  const dismiss = useDismissRequest(sale.id);
  const open = request.data;

  return (
    <>
      {open ? (
        <Card variant="tinted" style={styles.card} testID="refund-request">
          <StatusPill status="pending_approval" label={t('refundRequest.open')} />
          <Text>{t('refundRequest.summary', { name: open.members?.display_name ?? '', amount: formatMoney(open.amount_minor) })}</Text>
          <Text color="textOnTint">{open.reason}</Text>
          {role === 'owner' ? (
            <Button
              label={t('refundRequest.decline')}
              variant="ghost"
              size="md"
              loading={dismiss.isPending}
              onPress={() => dismiss.mutate({ id: open.id, note: null }, { onSuccess: () => toast(t('refundRequest.declined')) })}
              testID="refund-request-decline"
            />
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
});
