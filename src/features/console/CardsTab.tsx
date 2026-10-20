import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useCardPrice, type CardMode } from '@/features/plan/cardApi';
import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Card, EmptyState, FormError, ListRow, PillTabs, QueryState, StatusPill, Text } from '@/ui';

const ZONE = 'Asia/Dubai';
const STATUS = { pending: 'pending_approval', paid: 'valid', refunded: 'cancelled', review: 'expired' } as const;

interface CardPayment {
  id: string;
  salon: string | null;
  code: string | null;
  mode: 'test' | 'live';
  months: number;
  extra_people: number;
  amount_minor: number;
  paid_minor: number | null;
  paid_currency: string | null;
  status: keyof typeof STATUS;
  order_id: string | null;
  customer_email: string | null;
  note: string | null;
  created_at: string;
}

/**
 * Console → Card payments (2026-10-20): Creem card payments off, in test (only platform admins see the button) or
 * live; and the latest payments — paid, refunded (to look at), or to review (nobody matched).
 */
export function CardsTab() {
  const { t } = useTranslation();
  const dates = useDates();
  const client = useQueryClient();
  const price = useCardPrice();
  const payments = useQuery({
    queryKey: ['console', 'card-payments'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_card_payments');
      if (error) throw error;
      return (data ?? []) as unknown as CardPayment[];
    },
  });
  const setMode = useMutation({
    mutationFn: async (mode: CardMode) => {
      const { error } = await supabase.rpc('admin_set_card_payments', { p_mode: mode });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['platform', 'card-price'] }),
  });
  const money = (minor: number, currency: string) => (isCurrency(currency) ? formatMoney(minor, currency) : `${currency} ${minor}`);

  return (
    <View style={styles.list}>
      <Card variant="outlined" style={styles.card}>
        <Text variant="h4">{t('console.cards.title')}</Text>
        <Text variant="small" color="textSecondary">
          {t('console.cards.hint')}
        </Text>
        <PillTabs<CardMode>
          items={(['off', 'test', 'live'] as const).map((key) => ({ key, label: t(`console.cards.modes.${key}`) }))}
          value={price.data?.card_payments ?? 'off'}
          onChange={(mode) => setMode.mutate(mode)}
          testID="console-card-mode"
        />
        <FormError error={setMode.error} />
      </Card>
      <QueryState query={payments} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('console.cards.empty')} />}>
        {(rows) => (
          <View style={styles.list}>
            {rows.map((c) => (
              <ListRow
                key={c.id}
                title={c.salon ? `${c.salon} · ${c.code}` : t('console.cards.unmatched')}
                meta={[
                  [
                    t('console.plans.months', { count: c.months }),
                    c.extra_people ? t('console.cards.extra', { count: c.extra_people }) : null,
                    c.paid_minor !== null && c.paid_currency ? money(c.paid_minor, c.paid_currency) : money(c.amount_minor, 'USD'),
                    c.mode === 'test' ? t('console.cards.modes.test') : null,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  [dates.at(c.created_at, ZONE, 'd MMM yyyy · HH:mm'), c.customer_email, c.order_id, c.note].filter(Boolean).join(' · '),
                ]}
                badges={<StatusPill status={STATUS[c.status]} label={t(`console.cards.status.${c.status}`)} />}
              />
            ))}
          </View>
        )}
      </QueryState>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: { gap: spacing.md },
});
