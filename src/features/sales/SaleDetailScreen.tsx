import { formatInTimeZone } from 'date-fns-tz';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { Button, Card, FormError, HeaderBand, QueryState, Screen, SectionHeader, StatusPill, Text } from '@/ui';

import { useSale } from './api';
import { RefundSheet } from './RefundSheet';
import { useShareReceipt } from './useReceipt';

const STATUS_PILL = { completed: 'paid', partially_refunded: 'reversed', refunded: 'reversed' } as const;

function Row({ label, value, strong, testID }: { label: string; value: string; strong?: boolean; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text variant={strong ? 'h4' : 'body'} color={strong ? 'text' : 'textSecondary'} style={styles.flex}>
        {label}
      </Text>
      <Text variant={strong ? 'h4' : 'bodyStrong'} tabular testID={testID}>
        {value}
      </Text>
    </View>
  );
}

export function SaleDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business, role } = useWorkspace();
  const query = useSale(id);
  const share = useShareReceipt();
  const [refunding, setRefunding] = useState(false);
  const time = (iso: string) => formatInTimeZone(new Date(iso), business.timezone, 'd MMM yyyy · HH:mm');

  return (
    <>
      <Screen
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        header={
          <HeaderBand
            title={query.data ? t('sales.number', { number: query.data.number }) : t('sales.title')}
            subtitle={query.data ? time(query.data.created_at) : undefined}
            onBack
          />
        }
      >
        <QueryState query={query}>
          {(sale) => {
            const left = sale.total_minor - sale.refunded_minor;
            return (
              <View style={styles.body}>
                <View style={styles.head}>
                  <StatusPill
                    status={STATUS_PILL[sale.status]}
                    label={t(`sales.status.${sale.status}`)}
                  />
                  <Text color="textSecondary" style={styles.flex}>
                    {[sale.customer_name ?? t('queue.guest'), sale.employees?.full_name].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Card variant="outlined" style={styles.card}>
                  {sale.sale_lines.map((l) => (
                    <Row
                      key={l.id}
                      label={`${Number(l.qty)} × ${l.name_snapshot}`}
                      value={formatMoney(Math.round(l.unit_price_minor * Number(l.qty)))}
                    />
                  ))}
                </Card>
                <Card variant="outlined" style={styles.card}>
                  <Row label={t('sale.subtotal')} value={formatMoney(sale.subtotal_minor)} />
                  {sale.discount_minor ? <Row label={t('sale.discount')} value={formatMoney(-sale.discount_minor)} /> : null}
                  <Row
                    label={t('sale.vat')}
                    value={sale.vat_mode === 'on' ? t('sale.vatIncluded', { amount: formatMoney(sale.vat_minor) }) : t('sale.vatNotApplied')}
                  />
                  {sale.tip_minor ? <Row label={t('sale.tip')} value={formatMoney(sale.tip_minor)} /> : null}
                  <Row label={t('receipt.total')} value={formatMoney(sale.total_minor)} strong testID="sale-total" />
                  {sale.deposit_applied_minor ? (
                    <Row label={t('sale.depositApplied')} value={formatMoney(-sale.deposit_applied_minor)} />
                  ) : null}
                  {sale.sale_payments.map((p) => (
                    <Row key={p.id} label={t('sales.paidBy', { method: t(`sale.methods.${p.method}` as 'sale.methods.cash') })} value={formatMoney(p.amount_minor)} />
                  ))}
                </Card>
                {sale.refunds.length ? (
                  <View style={styles.card}>
                    <SectionHeader title={t('sales.refunds')} />
                    {sale.refunds.map((r) => (
                      <Card key={r.id} variant="tinted" style={styles.card}>
                        <Row
                          label={`${t(`sale.methods.${r.method}` as 'sale.methods.cash')} · ${time(r.created_at)}`}
                          value={formatMoney(-r.amount_minor)}
                        />
                        <Text variant="small" color="textOnTint">
                          {r.reason}
                        </Text>
                      </Card>
                    ))}
                  </View>
                ) : null}
                <FormError error={share.error} />
                <Button
                  label={t(Platform.OS === 'web' ? 'sale.printReceipt' : 'sale.shareReceipt')}
                  icon={Platform.OS === 'web' ? 'printer' : 'share'}
                  variant="secondary"
                  loading={share.isPending}
                  onPress={() => share.mutate(sale.id)}
                />
                {can(role, 'refund') && left > 0 ? (
                  <Button label={t('sales.refund')} icon="rotate" variant="ghost" onPress={() => setRefunding(true)} testID="sale-refund" />
                ) : null}
              </View>
            );
          }}
        </QueryState>
      </Screen>
      {query.data && can(role, 'refund') ? (
        <RefundSheet sale={query.data} open={refunding} onClose={() => setRefunding(false)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
