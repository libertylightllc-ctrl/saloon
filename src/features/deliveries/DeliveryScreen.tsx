import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { qtyText } from '@/features/inventory/labels';
import { ReceiptPhoto } from '@/features/moneyout/ReceiptPhoto';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { BottomSheet, Button, Card, FormError, HeaderBand, ListRow, QueryState, Screen, SectionHeader, StatusPill, Text, TextField, useToast } from '@/ui';

import { supplierOf, useCancelDelivery, useDelivery, type Delivery } from './api';
import { deliveryPill } from './labels';
import { PriceForm } from './PriceForm';

/** One delivery: what came, from whom, who took it in, the delivery note; prices to add, or the bill it became. */
export function DeliveryScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const { business, branch, role, member } = useWorkspace();
  const query = useDelivery(branch.id, id);
  const [cancelling, setCancelling] = useState(false);
  const d = query.data;
  const pricer = can(role, 'priceDelivery');

  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      header={<HeaderBand title={d ? t('deliveries.number', { number: d.number }) : t('deliveries.title')} subtitle={d ? (supplierOf(d) ?? undefined) : undefined} onBack />}
    >
      <QueryState query={query}>
        {(delivery) => (
          <View style={styles.body}>
            <Card variant="outlined" style={styles.card}>
              <View style={styles.row}>
                <Text variant="bodyStrong" style={styles.flex}>
                  {t('deliveries.receivedBy', {
                    name: delivery.received_name,
                    when: dates.at(new Date(delivery.received_at), business.timezone, 'EEE d MMM · HH:mm'),
                  })}
                </Text>
                <StatusPill {...deliveryPill(delivery.status, t)} />
              </View>
              {delivery.note ? <Text color="textSecondary">{delivery.note}</Text> : null}
              {delivery.status === 'cancelled' && delivery.cancel_reason ? (
                <Text color="textSecondary" testID="delivery-cancel-reason">
                  {t('deliveries.cancelledWhy', { reason: delivery.cancel_reason })}
                </Text>
              ) : null}
            </Card>
            <SectionHeader title={t('deliveries.items')} />
            <Card variant="outlined" padding={0}>
              {delivery.delivery_lines.map((l) => (
                <ListRow
                  key={l.id}
                  title={l.inventory_items?.name ?? '—'}
                  meta={[t('deliveries.lineQty', { count: Number(l.packs), qty: qtyText(l.packs * Number(l.pack_size ?? 1), l.inventory_items?.unit ?? 'pcs', t) })]}
                />
              ))}
            </Card>
            <ReceiptPhoto kind="bill" rowId={delivery.id} path={delivery.note_path} canAttach={false} title={t('deliveries.notePhoto')} />
            {delivery.status === 'priced' && delivery.bill_id && can(role, 'viewPurchases') ? (
              <Button
                label={t('deliveries.openBill')}
                icon="receipt"
                variant="secondary"
                onPress={() => router.push({ pathname: '/purchases/[id]', params: { id: delivery.bill_id! } })}
                testID="delivery-open-bill"
              />
            ) : null}
            {delivery.status === 'waiting' && pricer ? <PriceForm delivery={delivery} /> : null}
            {delivery.status === 'waiting' && !pricer ? (
              <Text color="textSecondary">{t('deliveries.waitingHint')}</Text>
            ) : null}
            {delivery.status === 'waiting' && (pricer || delivery.received_by === member.id) ? (
              <Button label={t('deliveries.cancel')} icon="x" variant="ghost" onPress={() => setCancelling(true)} testID="delivery-cancel" />
            ) : null}
            <BottomSheet open={cancelling} onClose={() => setCancelling(false)} title={t('deliveries.cancelTitle', { number: delivery.number })}>
              {cancelling ? <CancelForm delivery={delivery} onDone={() => setCancelling(false)} /> : null}
            </BottomSheet>
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

function CancelForm({ delivery, onDone }: { delivery: Delivery; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const cancel = useCancelDelivery(business.id, branch.id);
  const [reason, setReason] = useState('');
  return (
    <>
      <Text color="textSecondary">{t('deliveries.cancelHint')}</Text>
      <TextField label={t('deliveries.cancelReason')} value={reason} onChangeText={setReason} maxLength={200} testID="delivery-cancel-text" />
      <FormError error={cancel.error} />
      <Button
        label={t('deliveries.cancelConfirm')}
        variant="danger"
        disabled={reason.trim().length < 3}
        loading={cancel.isPending}
        onPress={() =>
          cancel.mutate(
            { id: delivery.id, reason: reason.trim() },
            {
              onSuccess: () => {
                toast(t('deliveries.cancelled', { number: delivery.number }));
                onDone();
              },
            },
          )
        }
        testID="delivery-cancel-confirm"
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
