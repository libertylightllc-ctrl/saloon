import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useTerms } from '@/features/mode/useTerms';
import { minutesBetween } from '@/lib/dates';
import { formatMoney, sum } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useNow } from '@/lib/useNow';
import { spacing } from '@/theme';
import { Button, Chip, EmptyState, HeaderBand, QueryState, Screen, SegmentTabs, useTwoPane } from '@/ui';

import { useAppointments, useEmployees, type Appointment, type QueueDay } from './api';
import { AppointmentActions } from './AppointmentActions';
import { QueueRow } from './QueueRow';
import { useQueueHandlers } from './useQueueHandlers';
import { VisitPanel } from './VisitPanel';

type Filter = 'all' | Appointment['status'];
const FILTERS: Filter[] = ['all', 'waiting', 'booked', 'in_progress', 'completed', 'no_show', 'cancelled'];

export function QueueScreen() {
  const { t } = useTranslation();
  const terms = useTerms();
  const router = useRouter();
  const now = useNow();
  const { business, branch, role, rules } = useWorkspace();
  const [day, setDay] = useState<QueueDay>('today');
  const [filter, setFilter] = useState<Filter>('all');
  const [staff, setStaff] = useState<string | null>(null);
  const query = useAppointments(branch.id, business.timezone, day);
  const employees = useEmployees(branch.id);
  const handlers = useQueueHandlers();
  // Tablets and computers: the list on one side, the picked visit on the other (Option B).
  const twoPane = useTwoPane();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const shows = (i: Appointment) => (filter === 'all' || i.status === filter) && (!staff || i.employee_id === staff);

  const items = query.data ?? [];
  const count = (status: Appointment['status']) => items.filter((i) => i.status === status).length;
  const longest = Math.max(
    0,
    ...items
      .filter((i) => i.status === 'waiting')
      .map((i) => minutesBetween(new Date(i.checked_in_at ?? i.scheduled_at), now)),
  );
  const held = sum(items.filter((i) => i.deposit_status === 'held').map((i) => i.deposit_minor));
  const visible = items.filter(shows);
  const selected = visible.find((i) => i.id === selectedId) ?? visible[0] ?? null;

  const listView = (
    <View style={styles.body}>
      <SegmentTabs<Filter>
        items={FILTERS.map((key) => ({
          key,
          label: key === 'all' ? t('queue.filters.all') : t(`status.${key}`),
          count: key === 'all' ? undefined : count(key),
        }))}
        value={filter}
        onChange={setFilter}
        testID="queue-filter"
      />
      {employees.data && employees.data.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <Chip label={terms.anyStaff} selected={staff === null} onPress={() => setStaff(null)} />
          {employees.data.map((person) => (
            <Chip
              key={person.id}
              label={person.full_name}
              selected={staff === person.id}
              onPress={() => setStaff(staff === person.id ? null : person.id)}
            />
          ))}
        </ScrollView>
      ) : null}
      <QueryState
        query={query}
        isEmpty={(data) => data.filter(shows).length === 0}
        empty={
          <EmptyState
            illustration="queue-empty"
            message={t('queue.empty')}
            actionLabel={t('queue.addWalkIn')}
            onAction={() => router.push({ pathname: '/appointment/new', params: { kind: 'walk_in' } })}
          />
        }
      >
        {(data) => (
          <View style={styles.list}>
            {data
              .filter(shows)
              .map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  now={now}
                  timeZone={business.timezone}
                  busy={handlers.busyId === item.id}
                  onAction={handlers.onAction}
                  canSell={can(role, 'sell', rules)}
                  onMore={handlers.openMenu}
                  onPress={twoPane ? () => setSelectedId(item.id) : undefined}
                  selected={item.id === selected?.id}
                />
              ))}
          </View>
        )}
      </QueryState>
    </View>
  );

  return (
    <>
      <Screen
        insetBottom={false}
        width="full"
        scroll={!twoPane}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        header={
          <HeaderBand
            title={t('queue.title')}
            right={
              <Button
                label={t('queue.new')}
                icon="plus"
                size="sm"
                variant="secondary"
                onPress={() => router.push('/appointment/new')}
                testID="queue-new"
              />
            }
          >
            <SegmentTabs<QueueDay>
              items={[
                { key: 'today', label: t('queue.days.today') },
                { key: 'tomorrow', label: t('queue.days.tomorrow') },
                { key: 'week', label: t('queue.days.week') },
              ]}
              value={day}
              onChange={setDay}
              testID="queue-day"
            />
            {/* The day at a glance wraps instead of sliding, so every number is in view. */}
            <View style={styles.summary}>
              <Chip tone="warning" icon="hourglass" label={t('queue.summary.waiting', { n: count('waiting'), minutes: longest })} />
              <Chip tone="primary" icon="calendar" label={t('queue.summary.booked', { n: count('booked') })} />
              <Chip tone="success" icon="circleCheck" label={t('queue.summary.completed', { n: count('completed') })} />
              {held > 0 ? <Chip tone="neutral" icon="coins" label={t('queue.summary.deposits', { amount: formatMoney(held) })} /> : null}
            </View>
          </HeaderBand>
        }
      >
        {twoPane ? (
          <View style={styles.split}>
            <ScrollView style={styles.listPane} contentContainerStyle={styles.pane} showsVerticalScrollIndicator={false}>
              {listView}
            </ScrollView>
            <ScrollView style={styles.flex} contentContainerStyle={styles.pane} showsVerticalScrollIndicator={false}>
              <VisitPanel
                item={selected}
                now={now}
                timeZone={business.timezone}
                busy={handlers.busyId === selected?.id}
                onAction={handlers.onAction}
                onMore={handlers.openMenu}
                canSell={can(role, 'sell', rules)}
              />
            </ScrollView>
          </View>
        ) : (
          listView
        )}
      </Screen>
      <AppointmentActions item={handlers.menuItem(query.data)} onClose={handlers.closeMenu} />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  row: { gap: spacing.sm },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.md },
  flex: { flex: 1 },
  split: { flex: 1, minHeight: 0, flexDirection: 'row', gap: spacing['2xl'] },
  listPane: { width: 440, flexGrow: 0, flexShrink: 0 },
  pane: { paddingBottom: spacing['2xl'] },
});
