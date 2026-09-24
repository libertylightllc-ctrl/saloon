import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useTerms } from '@/features/mode/useTerms';
import { formatMoney } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, Chip, EmptyState, HeaderBand, Screen, SegmentTabs, useToast } from '@/ui';

import type { DemoQueueItem } from './data';
import { QueueRow, type QueueAction } from './QueueRow';
import { useDemoBranch } from './useDemo';

type Day = 'today' | 'tomorrow' | 'week';
type Filter = 'all' | DemoQueueItem['status'];

const NEXT_STATUS: Partial<Record<QueueAction, DemoQueueItem['status']>> = {
  checkIn: 'waiting',
  start: 'in_progress',
  complete: 'completed',
};

export function QueueDemo() {
  const { t } = useTranslation();
  const terms = useTerms();
  const toast = useToast();
  const demo = useDemoBranch();
  const [items, setItems] = useState(demo.queue);
  const [day, setDay] = useState<Day>('today');
  const [filter, setFilter] = useState<Filter>('all');
  const [staff, setStaff] = useState<string | null>(null);

  // The demo data changes with the mode; start fresh when it does.
  const [source, setSource] = useState(demo.queue);
  if (source !== demo.queue) {
    setSource(demo.queue);
    setItems(demo.queue);
  }

  const count = (status: DemoQueueItem['status']) =>
    items.filter((i) => i.status === status).length;
  const longest = Math.max(
    0,
    ...items.filter((i) => i.status === 'waiting').map((i) => i.minutes ?? 0),
  );
  const visible = items.filter(
    (i) => (filter === 'all' || i.status === filter) && (!staff || i.staff === staff),
  );

  const act = (item: DemoQueueItem, action: QueueAction) => {
    const next = NEXT_STATUS[action];
    if (next)
      setItems((all) =>
        all.map((i) => (i.id === item.id ? { ...i, status: next, minutes: 0 } : i)),
      );
    toast(t(`queue.toast.${action}`, { name: item.customer ?? t('queue.guest') }));
  };

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: t('queue.filters.all') },
    { key: 'waiting', label: t('status.waiting'), count: count('waiting') },
    { key: 'booked', label: t('status.booked'), count: count('booked') },
    { key: 'in_progress', label: t('status.in_progress'), count: count('in_progress') },
    { key: 'completed', label: t('status.completed'), count: count('completed') },
    { key: 'no_show', label: t('status.no_show'), count: count('no_show') },
  ];

  return (
    <Screen
      insetBottom={false}
      header={
        <HeaderBand
          title={t('queue.title')}
          right={
            <Button
              label={t('queue.new')}
              icon="plus"
              size="sm"
              variant="secondary"
              onPress={() => toast(t('dev.laterPhase'), 'info')}
            />
          }
        >
          <SegmentTabs<Day>
            items={[
              { key: 'today', label: t('queue.days.today') },
              { key: 'tomorrow', label: t('queue.days.tomorrow') },
              { key: 'week', label: t('queue.days.week') },
            ]}
            value={day}
            onChange={setDay}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Chip
              tone="warning"
              icon="hourglass"
              label={t('queue.summary.waiting', { n: count('waiting'), minutes: longest })}
            />
            <Chip
              tone="primary"
              icon="calendar"
              label={t('queue.summary.booked', { n: count('booked') })}
            />
            <Chip
              tone="success"
              icon="circleCheck"
              label={t('queue.summary.completed', { n: count('completed') })}
            />
            <Chip
              tone="neutral"
              icon="coins"
              label={t('queue.summary.deposits', { amount: formatMoney(20000) })}
            />
          </ScrollView>
        </HeaderBand>
      }
    >
      <View style={styles.body}>
        <SegmentTabs<Filter> items={filters} value={filter} onChange={setFilter} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.staffRow}
        >
          <Chip label={terms.anyStaff} selected={staff === null} onPress={() => setStaff(null)} />
          {demo.staff.map((person) => (
            <Chip
              key={person.id}
              label={person.name}
              selected={staff === person.name}
              onPress={() => setStaff(staff === person.name ? null : person.name)}
            />
          ))}
        </ScrollView>
        {visible.length ? (
          <View style={styles.list}>
            {visible.map((item) => (
              <QueueRow key={item.id} item={item} onAction={act} />
            ))}
          </View>
        ) : (
          <EmptyState
            illustration="queue-empty"
            message={t('queue.empty')}
            actionLabel={t('queue.addWalkIn')}
            onAction={() => toast(t('dev.laterPhase'), 'info')}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  chips: { gap: spacing.sm },
  staffRow: { gap: spacing.sm },
  list: { gap: spacing.md },
});
