import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Chip, EmptyState, ListRow, QueryState, StatusPill } from '@/ui';

import { useActivity, usePlanEvents } from './api';

const ZONE = 'Asia/Dubai';
const KIND_STATUS = { request: 'pending_approval', activate: 'valid', end: 'cancelled' } as const;

/** Every plan request, payment and ending, newest first. */
export function PlansTab() {
  const { t } = useTranslation();
  const dates = useDates();
  const events = usePlanEvents();
  return (
    <QueryState query={events} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('console.plans.empty')} />}>
      {(rows) => (
        <View style={styles.list}>
          {rows.map((e) => (
            <ListRow
              key={e.id}
              title={e.salon}
              meta={[
                [
                  e.months ? t('console.plans.months', { count: e.months }) : null,
                  e.amount_minor !== null && e.currency ? (isCurrency(e.currency) ? formatMoney(e.amount_minor, e.currency) : `${e.currency} ${e.amount_minor}`) : null,
                  e.paid_until ? t('admin.until', { date: dates.day(e.paid_until, 'd MMM yyyy') }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—',
                [dates.at(e.created_at, ZONE, 'd MMM yyyy · HH:mm'), e.by_name, e.note].filter(Boolean).join(' · '),
              ]}
              badges={
                <StatusPill
                  status={KIND_STATUS[e.kind as keyof typeof KIND_STATUS] ?? 'pending_approval'}
                  label={t(`console.plans.kinds.${e.kind}` as 'console.plans.kinds.request', { defaultValue: e.kind })}
                />
              }
            />
          ))}
        </View>
      )}
    </QueryState>
  );
}

/** The history across salons (or of one salon), newest first: who did what. */
export function ActivityTab({ salon, onClear }: { salon: { id: string; name: string } | null; onClear: () => void }) {
  const { t } = useTranslation();
  const dates = useDates();
  const activity = useActivity(salon?.id ?? null);
  return (
    <>
      {salon ? (
        <View style={styles.filter}>
          <Chip label={`${salon.name}  ×`} selected onPress={onClear} testID="console-activity-clear" />
        </View>
      ) : null}
      <QueryState query={activity} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('console.activity.empty')} />}>
        {(rows) => (
          <View style={styles.list}>
            {rows.map((a) => (
              <ListRow
                key={a.id}
                title={a.summary}
                meta={[[a.salon, a.actor, dates.at(a.created_at, ZONE, 'd MMM yyyy · HH:mm')].filter(Boolean).join(' · ')]}
              />
            ))}
          </View>
        )}
      </QueryState>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  filter: { flexDirection: 'row' },
});
