import { useTranslation } from 'react-i18next';

import { useTerms } from '@/features/mode/useTerms';
import { minutesBetween } from '@/lib/dates';
import { formatMoney, sum } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { semantic } from '@/theme';
import { Avatar, Button, IconButton, ListRow, StatusPill } from '@/ui';

import type { Appointment } from './api';

export type RowAction = 'checkIn' | 'start' | 'complete';

export function primaryAction(status: Appointment['status']): RowAction | null {
  if (status === 'booked') return 'checkIn';
  if (status === 'waiting') return 'start';
  if (status === 'in_progress') return 'complete';
  return null;
}

export function QueueRow({
  item,
  now,
  timeZone,
  compact,
  busy,
  onAction,
  onMore,
}: {
  item: Appointment;
  now: Date;
  timeZone: string;
  compact?: boolean;
  busy?: boolean;
  onAction?: (item: Appointment, action: RowAction) => void;
  onMore?: (item: Appointment) => void;
}) {
  const { t } = useTranslation();
  const dates = useDates();
  const terms = useTerms();
  const name = item.customer_name ?? t('queue.guest');
  const time = dates.at(new Date(item.scheduled_at), timeZone, 'HH:mm');
  const action = onAction ? primaryAction(item.status) : null;

  const when = (() => {
    if (item.status === 'waiting') {
      const since = new Date(item.checked_in_at ?? item.scheduled_at);
      return `${time} · ${t('queue.waitingFor', { minutes: Math.max(0, minutesBetween(since, now)) })}`;
    }
    if (item.status === 'booked') {
      const until = minutesBetween(now, new Date(item.scheduled_at));
      return `${time} · ${until >= 0 ? t('queue.inMinutes', { minutes: until }) : t('queue.late', { minutes: -until })}`;
    }
    if (item.status === 'in_progress' && item.started_at) {
      return t('queue.startedAt', { time: dates.at(new Date(item.started_at), timeZone, 'HH:mm') });
    }
    return time;
  })();

  const services = item.appointment_services.map((s) => s.name_snapshot).join(' + ');
  const price = sum(item.appointment_services.map((s) => s.price_minor));
  const staff = [item.employees?.full_name ?? terms.anyStaff, item.rooms?.name].filter(Boolean).join(' · ');

  const actionButton = action ? (
    <Button
      label={t(`queue.actions.${action}`)}
      size="sm"
      variant="row"
      loading={busy}
      onPress={() => onAction?.(item, action)}
      testID={`${compact ? 'home-queue' : 'queue'}-${action}-${item.id}`}
    />
  ) : null;

  return (
    <ListRow
      testID={`${compact ? 'home-queue' : 'queue'}-row-${item.id}`}
      title={name}
      leading={<Avatar name={name} size={44} />}
      meta={[
        {
          icon: item.status === 'waiting' ? 'hourglass' : 'clock',
          text: when,
          iconColor: item.status === 'waiting' ? semantic.warning.pressed : undefined,
        },
        services ? `${services} · ${formatMoney(price)}` : t('queue.noServices'),
        ...(compact ? [] : [{ icon: 'user' as const, text: staff }]),
      ]}
      badges={
        compact ? undefined : (
          <>
            {item.source === 'walk_in' ? <StatusPill tone="primary" label={t('queue.badges.walk_in')} /> : null}
            {item.deposit_status === 'held' ? (
              <StatusPill tone="success" label={t('queue.depositHeld', { amount: formatMoney(item.deposit_minor) })} />
            ) : null}
          </>
        )
      }
      trailing={compact ? actionButton : <StatusPill status={item.status} />}
      footer={
        compact || (!actionButton && !onMore) ? undefined : (
          <>
            {actionButton}
            {onMore ? (
              <IconButton
                icon="ellipsis"
                variant="plain"
                size={32}
                accessibilityLabel={t('queue.moreActions', { name })}
                onPress={() => onMore(item)}
                testID={`queue-more-${item.id}`}
              />
            ) : null}
          </>
        )
      }
    />
  );
}
