import { useTranslation } from 'react-i18next';

import { useTerms } from '@/features/mode/useTerms';
import { formatMoney } from '@/lib/money';
import { semantic, type Tone } from '@/theme';
import { Avatar, Button, IconButton, ListRow, StatusPill } from '@/ui';

import type { DemoQueueItem, QueueBadge } from './data';

const BADGE_TONE: Record<QueueBadge, Tone> = {
  walk_in: 'primary',
  preferred: 'primary',
  patch_test: 'warning',
  second_no_show: 'error',
  deposit: 'success',
};

export type QueueAction = 'checkIn' | 'start' | 'complete' | 'rebook';

export const NEXT_ACTION: Record<DemoQueueItem['status'], QueueAction> = {
  waiting: 'start',
  booked: 'checkIn',
  in_progress: 'complete',
  completed: 'rebook',
  no_show: 'rebook',
};

export function QueueRow({
  item,
  compact,
  onAction,
}: {
  item: DemoQueueItem;
  compact?: boolean;
  onAction?: (item: DemoQueueItem, action: QueueAction) => void;
}) {
  const { t } = useTranslation();
  const terms = useTerms();
  const name = item.customer ?? t('queue.guest');
  const action = NEXT_ACTION[item.status];

  const when =
    item.status === 'waiting'
      ? t('queue.waitingFor', { minutes: item.minutes ?? 0 })
      : item.status === 'booked'
        ? t('queue.inMinutes', { minutes: item.minutes ?? 0 })
        : item.status === 'in_progress'
          ? t('queue.startedAt', { time: item.time })
          : item.time;
  const staff = [item.staff ?? terms.anyStaff, item.room].filter(Boolean).join(' · ');

  const actionButton = (
    <Button
      label={t(`queue.actions.${action}`)}
      size="sm"
      variant={action === 'rebook' ? 'outline' : 'primary'}
      onPress={() => onAction?.(item, action)}
    />
  );

  return (
    <ListRow
      title={name}
      leading={<Avatar name={name} size={44} />}
      meta={[
        {
          icon: item.status === 'waiting' ? 'hourglass' : 'clock',
          text:
            item.status === 'waiting' || item.status === 'booked' ? `${item.time} · ${when}` : when,
          iconColor: item.status === 'waiting' ? semantic.warning.pressed : undefined,
        },
        `${item.services} · ${formatMoney(item.priceMinor)}`,
        ...(compact ? [] : [{ icon: 'user' as const, text: staff }]),
      ]}
      badges={
        compact || (item.badges.length === 0 && !item.visits) ? undefined : (
          <>
            {item.badges.map((badge) => (
              <StatusPill key={badge} tone={BADGE_TONE[badge]} label={t(`queue.badges.${badge}`)} />
            ))}
            {item.visits ? (
              <StatusPill tone="neutral" label={t('queue.visits', { n: item.visits })} />
            ) : null}
          </>
        )
      }
      trailing={compact ? actionButton : <StatusPill status={item.status} />}
      footer={
        compact ? undefined : (
          <>
            {actionButton}
            <IconButton
              icon="ellipsis"
              variant="plain"
              size={32}
              accessibilityLabel={t('queue.moreActions', { name })}
            />
          </>
        )
      }
    />
  );
}
