import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Chip, EmptyState, ListRow, QueryState, StatusPill } from '@/ui';

import { useActivityText } from '@/features/activity/activityText';

import { useActivity, usePlanEvents, useTestSalons } from './api';
import { useConsoleTime } from './zone';
import { mergeRepeatRequests } from './planEvents';

const KIND_STATUS = { request: 'pending_approval', activate: 'valid', end: 'cancelled' } as const;
/** The event's date in words: the column is paid_until for every kind, but a free period, pilot or access change
 *  stores the end of free time there. */
const UNTIL = { pilot: 'console.access.pilotUntil', trial: 'console.access.freeUntil', access: 'console.access.freeUntil' } as const;

/** Every plan request, payment and ending, newest first; a request sent again is one row (final brief E3). */
export function PlansTab() {
  const { t } = useTranslation();
  const dates = useDates();
  const events = usePlanEvents();
  const time = useConsoleTime();
  const tests = useTestSalons();
  return (
    <QueryState query={events} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('console.plans.empty')} />}>
      {(rows) => (
        <View style={styles.list}>
          {mergeRepeatRequests(rows).map((e) => (
            <ListRow
              key={e.id}
              title={e.salon}
              testID={`plan-event-${e.kind}-${e.salon}`}
              meta={[
                [
                  e.months ? t('console.plans.months', { count: e.months }) : null,
                  e.amount_minor !== null && e.currency ? (isCurrency(e.currency) ? formatMoney(e.amount_minor, e.currency) : `${e.currency} ${e.amount_minor}`) : null,
                  e.paid_until ? t(UNTIL[e.kind as keyof typeof UNTIL] ?? 'admin.until', { date: dates.day(e.paid_until, 'd MMM yyyy') }) : null,
                  // Paid on top of time still running (owner's brief A5): "13 months paid in 3 payments".
                  e.kind === 'activate' && (e.stack_payments ?? 1) > 1
                    ? t('console.plans.stack', { months: t('console.plans.months', { count: e.stack_months ?? 0 }), count: e.stack_payments })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—',
                [time.mine(e.created_at), e.by_name, e.note].filter(Boolean).join(' · '),
                ...(e.repeats > 1 ? [t('console.plans.repeats', { count: e.repeats, date: time.mine(e.first_at) })] : []),
              ]}
              badges={
                <View style={styles.badges}>
                  <StatusPill
                    status={KIND_STATUS[e.kind as keyof typeof KIND_STATUS] ?? 'pending_approval'}
                    label={t(`console.plans.kinds.${e.kind}` as 'console.plans.kinds.request', { defaultValue: e.kind })}
                  />
                  {tests.data?.has(e.business_id) ? <StatusPill tone="info" label={t('console.salons.test')} /> : null}
                  {e.mark === 'test' || e.mark === 'void' ? <StatusPill status="cancelled" label={t(`console.payments.mark.${e.mark}`)} /> : null}
                </View>
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
  const activity = useActivity(salon?.id ?? null);
  const time = useConsoleTime();
  const activityText = useActivityText();
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
                // The app's own words (owner's brief A8), at the salon's own time and place (A9).
                title={activityText(a.summary)}
                meta={[[a.salon, a.actor, time.salon(a.created_at, a.timezone ?? time.zone)].filter(Boolean).join(' · ')]}
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
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filter: { flexDirection: 'row' },
});
