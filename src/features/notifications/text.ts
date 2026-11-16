import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { formatBps, formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import type { IconName } from '@/ui';

import type { AppNotification } from './api';

/** Every alert type the app has words for; any other type shows the stored English text. */
export const NOTIFICATION_ICON = {
  new_booking: 'calendarPlus',
  online_booking: 'calendarPlus',
  online_cancelled: 'calendarX',
  booking_moved: 'calendarClock',
  booking_cancelled: 'calendarX',
  client_arrived: 'userCheck',
  no_show: 'calendarX',
  long_wait: 'hourglass',
  close_submitted: 'banknote',
  cash_difference: 'warning',
  missed_clock_out: 'clock',
  low_stock: 'package',
  delivery_waiting: 'truck',
  bill_due: 'receipt',
  month_ready: 'lock',
  document_due: 'shield',
  payroll_generated: 'wallet',
  refund_requested: 'rotate',
  refund_made: 'rotate',
  discount_over_limit: 'percent',
  daily_digest: 'sparkles',
  support_reply: 'messageCircle',
  trial_ending: 'sparkles',
} as const satisfies Record<string, IconName>;
type Known = keyof typeof NOTIFICATION_ICON;
const known = (type: string): type is Known => type in NOTIFICATION_ICON;

/**
 * The morning summary's extra parts, each only when there is something to say (owner's app check A6: out of stock
 * is counted apart from low; written "label: number" so every number reads right in every language).
 */
export function digestParts(d: Record<string, unknown>, t: TFunction): string[] {
  const n = (k: string) => (typeof d[k] === 'number' ? d[k] : 0);
  return [
    ...(n('pending_closes') > 0 ? [t('notifications.types.daily_digest.closes', { n: n('pending_closes') })] : []),
    ...(n('out_of_stock') > 0 ? [t('inventory.outCount', { n: n('out_of_stock') })] : []),
    ...(n('low_stock') > 0 ? [t('inventory.lowShort', { n: n('low_stock') })] : []),
  ];
}

export interface Formats {
  /** An instant, e.g. a booking time. */
  at: (iso: string) => string;
  /** A business date with a date-fns pattern. */
  day: (date: string, pattern: string) => string;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);
const joined = (parts: (string | null)[]) => parts.filter(Boolean).join(' · ');

/** The words for a notification in the app language (the stored English text is for push). */
export function notificationText(n: Pick<AppNotification, 'type' | 'title' | 'body' | 'data'>, t: TFunction, f: Formats) {
  if (!known(n.type)) return { title: n.title, body: n.body };
  const d = n.data;
  const type: Known = n.type;
  const reason = str(d.reason) ? t('approvalLog.reason', { reason: d.reason }) : null;
  const values = {
    ...d,
    at: str(d.at) ? f.at(d.at as string) : '',
    date: str(d.date) ? f.day(d.date as string, 'EEE d MMM') : '',
    due: str(d.due) ? f.day(d.due as string, 'EEE d MMM') : '',
    month: str(d.month) ? f.day(`${d.month as string}-01`, 'MMMM yyyy') : '',
    expires: str(d.expires_on) ? f.day(d.expires_on as string, 'd MMM yyyy') : '',
    until: str(d.until) ? f.day(d.until as string, 'd MMM yyyy') : '',
    amount: num(d.amount_minor) !== null ? formatMoney(d.amount_minor as number) : '',
    variance: num(d.variance_minor) !== null ? formatMoney(d.variance_minor as number) : '',
    unpaid: num(d.left_minor) !== null ? formatMoney(d.left_minor as number) : '',
    sales_total: num(d.sales_minor) !== null ? formatMoney(d.sales_minor as number) : '',
    doc: str(d.doc_type) ? (t(`compliance.types.${d.doc_type as string}` as 'compliance.types.visa', { defaultValue: d.doc_type }) as string) : '',
    customer: str(d.customer) ?? t('queue.guest'),
    count: num(d.days) ?? 0,
  };
  // Each type's own keys (title, body and a few variants); the cast names one of them for the typed `t`.
  const words = (key: string) => t(`notifications.types.${type}.${key}` as 'notifications.types.new_booking.title', values) as string;

  switch (type) {
    case 'low_stock':
      return d.out ? { title: words('outTitle'), body: words('outBody') } : { title: words('title'), body: words('body') };
    case 'daily_digest':
      return { title: words('title'), body: [words('body'), ...digestParts(d, t)].join(' · ') };
    case 'document_due':
      // "Due today" and "due tomorrow", never "in 0 days" (owner's fix list, 16 Nov).
      return { title: words(values.count === 0 ? 'titleToday' : values.count === 1 ? 'titleTomorrow' : 'title'), body: words('body') };
    case 'booking_moved':
      return { title: words('title'), body: d.reassigned ? words('bodyReassigned') : words('body') };
    case 'cash_difference': {
      const v = num(d.variance_minor) ?? 0;
      const title = t(`notifications.types.cash_difference.${v < 0 ? 'short' : 'over'}`, { ...values, amount: formatMoney(Math.abs(v)) });
      return { title, body: joined([t('notifications.types.cash_difference.body', { name: str(d.counted_by) ?? '?' }), reason]) };
    }
    case 'discount_over_limit':
    case 'refund_made': {
      const amount = num(d.amount) ?? 0;
      const limit = num(d.limit);
      const title =
        type === 'discount_over_limit'
          ? t(limit !== null ? 'notifications.types.discount_over_limit.titleLimit' : 'notifications.types.discount_over_limit.title', {
              pct: formatBps(amount),
              limit: limit !== null ? formatBps(limit) : '',
            })
          : t(d.action === 'deposit_refund' ? 'approvalLog.depositRefund' : 'approvalLog.refund', { amount: formatMoney(amount) });
      const by = str(d.by);
      const approver = str(d.approved_by);
      return {
        title,
        body: joined([by, approver && approver !== by ? t('notifications.approvedBy', { name: approver }) : null, reason]),
      };
    }
    default:
      return { title: words('title'), body: words('body') };
  }
}

export function useNotificationText() {
  const { t } = useTranslation();
  const dates = useDates();
  const { business } = useWorkspace();
  const f: Formats = { at: (iso) => dates.at(iso, business.timezone, 'EEE d MMM · HH:mm'), day: dates.day };
  return (n: AppNotification) => notificationText(n, t, f);
}
