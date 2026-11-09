import { useRouter, type Href } from 'expo-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { DOC_STATUS } from '@/features/compliance/labels';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, ListRow, SectionHeader, StatusPill, type StatusKey } from '@/ui';

import type { Dashboard } from './api';

interface Item {
  key: string;
  title: string;
  sub: string;
  status: StatusKey;
  /** The pill's words when the status name alone would mislead (a compliance record expiring in 2 days). */
  label?: string;
  action: string;
  href: Href;
}

/** Home "Needs attention": closes waiting for the owner, days never closed, low stock, tools due a
 * service and supplier bills overdue or due this week. */
export function NeedsAttention({ data }: { data: Dashboard }) {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const { role } = useWorkspace();
  const closing = data.closing;
  const items: Item[] = [];

  if (closing && can(role, 'approveClosing')) {
    for (const p of closing.pending) {
      items.push({
        key: `close-${p.business_date}`,
        title: t('home.attention.closePending', { date: dates.day(p.business_date, 'EEE d MMM') }),
        sub: t('home.attention.closePendingSub', { amount: formatMoney(p.variance_minor ?? 0) }),
        status: 'pending_approval',
        action: t('home.attentionActions.review'),
        href: { pathname: '/cash-closing/[date]', params: { date: p.business_date } },
      });
    }
  }
  if (closing && can(role, 'countCash')) {
    for (const day of closing.unclosed_days) {
      items.push({
        key: `unclosed-${day}`,
        title: t('home.attention.unclosed', { date: dates.day(day, 'EEE d MMM') }),
        sub: t('home.attention.unclosedSub'),
        status: 'overdue',
        action: t('home.attentionClose'),
        href: { pathname: '/cash-closing/[date]', params: { date: day } },
      });
    }
  }
  const stock = data.stock;
  if (stock && stock.low > 0 && role !== 'accountant') {
    items.push({
      key: 'low-stock',
      title: t('home.attention.lowStock', { count: stock.low }),
      sub: stock.low_items.slice(0, 3).join(', '),
      status: 'low',
      action: can(role, 'addPurchase') ? t('home.attentionActions.order') : t('home.attentionActions.review'),
      href: { pathname: '/inventory', params: { filter: 'low' } },
    });
  }
  if (stock && stock.tools_due > 0 && can(role, 'manageInventory')) {
    items.push({
      key: 'tools-due',
      title: t('home.attention.toolsDue', { count: stock.tools_due }),
      sub: t('home.attention.toolsDueSub'),
      status: 'due_soon',
      action: t('home.attentionActions.review'),
      href: { pathname: '/inventory', params: { filter: 'tool' } },
    });
  }
  const bills = data.bills;
  if (bills && can(role, 'payOrReverseMoneyOut')) {
    if (bills.overdue_count > 0) {
      items.push({
        key: 'bills-overdue',
        title: t('home.attention.billsOverdue', { count: bills.overdue_count }),
        sub: t('home.attention.billsSub', { amount: formatMoney(bills.overdue_minor) }),
        status: 'overdue',
        action: t('home.attentionActions.pay'),
        href: '/purchases',
      });
    }
    if (bills.due_soon_count > 0) {
      items.push({
        key: 'bills-due',
        title: t('home.attention.billsDue', { count: bills.due_soon_count }),
        sub: t('home.attention.billsSub', { amount: formatMoney(bills.due_soon_minor) }),
        status: 'due_soon',
        action: t('home.attentionActions.pay'),
        href: '/purchases',
      });
    }
  }
  const payroll = data.payroll;
  if (payroll && can(role, 'runPayroll')) {
    if (payroll.pending_period) {
      items.push({
        key: 'payroll-approval',
        title: t('home.attention.payrollPending', { month: dates.day(`${payroll.pending_period}-01`, 'MMMM yyyy') }),
        sub: t('home.attention.payrollPendingSub'),
        status: 'pending_approval',
        action: t('home.attentionActions.review'),
        href: '/payroll',
      });
    }
    if (payroll.wps_missing > 0) {
      items.push({
        key: 'wps-missing',
        title: t('home.attention.wpsMissing', { count: payroll.wps_missing }),
        sub: t('home.attention.wpsMissingSub'),
        status: 'due_soon',
        action: t('home.attentionActions.review'),
        href: '/payroll',
      });
    }
  }
  const compliance = data.compliance;
  if (compliance && compliance.attention > 0) {
    items.push({
      key: 'compliance',
      title: t('home.attention.compliance', { count: compliance.attention }),
      sub: COMPLIANCE_ORDER.filter((s) => compliance[s] > 0)
        .map((s) => t('home.attention.compliancePart', { label: t(`compliance.status.${s}`), count: compliance[s] }))
        .join(' · '),
      ...compliancePill(compliance, t),
      action: t('home.attentionActions.renew'),
      href: '/compliance',
    });
  }
  if (data.hygiene_signed === false && can(role, 'signHygiene')) {
    items.push({
      key: 'hygiene',
      title: t('home.attention.hygiene'),
      sub: t('home.attention.hygieneSub'),
      status: 'due_soon',
      action: t('home.attentionActions.review'),
      href: { pathname: '/compliance', params: { tab: 'hygiene' } },
    });
  }
  if (items.length === 0) return null;

  return (
    <View style={styles.block}>
      <SectionHeader title={t('home.needsAttention')} />
      {items.map((item) => (
        <ListRow
          key={item.key}
          testID={`attention-${item.key}`}
          title={item.title}
          meta={[item.sub]}
          badges={<StatusPill status={item.status} label={item.label} />}
          trailing={
            <Button
              label={item.action}
              size="sm"
              variant="secondary"
              onPress={() => router.push(item.href)}
              testID={`attention-${item.key}-action`}
            />
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
});

const COMPLIANCE_ORDER = ['expired', 'missing', 'evidence_missing', 'missing_date', 'due_soon'] as const;

/**
 * The compliance line's pill (owner's app check A4): "Expired" only when a date has passed; otherwise the nearest
 * expiry ("Expires in 2 days"), then a record never entered, a missing scan, a missing date.
 */
export function compliancePill(c: NonNullable<Dashboard['compliance']>, t: TFunction): { status: StatusKey; label?: string } {
  if (c.expired > 0) return { status: 'expired' };
  if (c.soonest_days !== null) {
    return {
      status: 'due_soon',
      label: c.soonest_days === 0 ? t('home.attention.expiresToday') : t('home.attention.expiresIn', { count: c.soonest_days }),
    };
  }
  const worst = COMPLIANCE_ORDER.find((s) => c[s] > 0) ?? 'due_soon';
  return { status: DOC_STATUS[worst], label: t(`compliance.status.${worst}`) };
}
