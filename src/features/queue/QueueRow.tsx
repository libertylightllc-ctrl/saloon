import { useTranslation } from 'react-i18next';

import { useTerms } from '@/features/mode/useTerms';
import { formatMoney, sum } from '@/lib/money';
import { semantic } from '@/theme';
import { Avatar, Button, IconButton, ListRow, StatusPill } from '@/ui';

import type { Appointment } from './api';
import { primaryAction, type RowAction } from './actions';
import { useVisitWhen } from './visitText';

export function QueueRow({
  item,
  now,
  timeZone,
  compact,
  busy,
  onAction,
  onMore,
  canSell = true,
  onPress,
  selected,
}: {
  item: Appointment;
  now: Date;
  timeZone: string;
  compact?: boolean;
  busy?: boolean;
  onAction?: (item: Appointment, action: RowAction) => void;
  onMore?: (item: Appointment) => void;
  /** False for staff when the branch does not let them take payments. */
  canSell?: boolean;
  /** Two panes (tablets, computers): the row selects the visit; its actions are in the pane beside the list. */
  onPress?: () => void;
  selected?: boolean;
}) {
  const { t } = useTranslation();
  const terms = useTerms();
  const visitWhen = useVisitWhen();
  const name = item.customer_name ?? t('queue.guest');
  const action = onAction && !onPress ? primaryAction(item.status, canSell) : null;
  const when = visitWhen(item, now, timeZone);

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
      onPress={onPress}
      selected={onPress ? selected : undefined}
      footer={
        compact || onPress || (!actionButton && !onMore) ? undefined : (
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
