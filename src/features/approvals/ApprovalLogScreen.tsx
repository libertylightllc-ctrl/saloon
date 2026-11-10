import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { atBusinessTime, businessMonth, shiftMonth, type MonthKey } from '@/lib/dates';
import { formatBps, formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { EmptyState, HeaderBand, ListRow, MonthSwitcher, QueryState, Screen, StatusPill, Text } from '@/ui';

import { useApprovalLog, type ApprovalLogRow } from './api';

const CLOCK = ['in', 'out', 'break_start', 'break_end', 'resume'] as const;

/** What was allowed, in the words the approval step used ("Discount 25% (limit 10%)", "Refund AED 40.00 · sale #12"). */
export function approvalWhat(r: ApprovalLogRow, t: TFunction): string {
  const money = formatMoney(r.amount ?? 0);
  switch (r.action) {
    case 'discount':
      return r.limit_amount !== null
        ? t('approval.discount', { pct: formatBps(r.amount ?? 0), limit: formatBps(r.limit_amount) })
        : t('approvalLog.discount', { pct: formatBps(r.amount ?? 0) });
    case 'price_change':
      return t('approval.priceChange', { amount: money });
    case 'refund':
      return typeof r.details.sale === 'number' ? t('approval.refund', { amount: money, number: r.details.sale }) : t('approvalLog.refund', { amount: money });
    case 'deposit_refund':
      return t('approvalLog.depositRefund', { amount: money });
    case 'petty_cash':
      return t('approval.pettyCash', { amount: money });
    case 'clock_other': {
      const what = CLOCK.find((a) => a === r.details.what);
      const name = typeof r.details.employee === 'string' ? r.details.employee : '';
      return what && name ? t('approval.clockOther', { name, action: t(`attendance.actions.${what}`) }) : t('approvalLog.clockOther');
    }
  }
}

/**
 * Reports → Approvals (brief B5, owner and managers): every PIN approval that was used, and every refund, price
 * change, discount above the limit and deposit given back by a manager or the owner with their reason; month by month.
 */
export function ApprovalLogScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const { business, branch } = useWorkspace();
  const [month, setMonth] = useState<MonthKey>(businessMonth(new Date(), business.timezone));
  const from = atBusinessTime(`${month}-01`, '00:00', business.timezone);
  const to = atBusinessTime(`${shiftMonth(month, 1)}-01`, '00:00', business.timezone);
  const log = useApprovalLog(branch.id, from, to);

  return (
    <Screen
      refreshing={log.isRefetching}
      onRefresh={() => void log.refetch()}
      header={
        <HeaderBand title={t('approvalLog.title')} subtitle={t('approvalLog.subtitle')} onBack>
          <MonthSwitcher value={month} onChange={setMonth} />
        </HeaderBand>
      }
    >
      <QueryState query={log} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('approvalLog.empty')} />}>
        {(rows) => (
          <View style={styles.body}>
            <Text color="textSecondary" testID="approvals-count">
              {t('approvalLog.count', { count: rows.length })}
            </Text>
            {rows.map((r) => (
              <ListRow
                key={r.id}
                testID={`approval-${r.action}`}
                title={approvalWhat(r, t)}
                meta={[
                  r.method === 'pin'
                    ? t('approvalLog.byPin', { asked: r.requested_name, approved: r.approved_name })
                    : t('approvalLog.byReason', { name: r.requested_name }),
                  ...(r.reason ? [t('approvalLog.reason', { reason: r.reason })] : []),
                  dates.at(new Date(r.created_at), business.timezone, 'EEE d MMM · HH:mm'),
                ]}
                badges={<StatusPill tone={r.method === 'pin' ? 'warning' : 'neutral'} label={t(`approvalLog.method.${r.method}`)} />}
                chevron={r.ref_type === 'sale' && Boolean(r.ref_id)}
                onPress={r.ref_type === 'sale' && r.ref_id ? () => router.push({ pathname: '/sales/[id]', params: { id: r.ref_id! } }) : undefined}
              />
            ))}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
});
