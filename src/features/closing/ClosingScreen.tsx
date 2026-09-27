import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { isBusinessDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { semantic, spacing } from '@/theme';
import { Card, EmptyState, HeaderBand, ListRow, QueryState, Screen, SectionHeader, StatusPill, Text, type StatusKey } from '@/ui';

import { useClosingHistory, useClosingPreview, type ClosingStatus } from './api';
import { CloseSummary } from './CloseSummary';
import { CountForm } from './CountForm';
import { ExpectedCard } from './ExpectedCard';
import { TipsCard } from './TipsCard';

const HISTORY_STATUS: Record<ClosingStatus, StatusKey | null> = {
  open: null,
  draft: null,
  pending_approval: 'pending_approval',
  approved: 'approved',
};

/** Cash closing for today (or `/cash-closing/<date>` for an earlier day), with tips and history. */
export function ClosingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date && isBusinessDate(params.date) ? params.date : undefined;
  const { branch, role } = useWorkspace();
  const preview = useClosingPreview(branch.id, date);
  const history = useClosingHistory(branch.id);
  const refresh = () => {
    void preview.refetch();
    void history.refetch();
  };

  return (
    <Screen
      refreshing={preview.isRefetching}
      onRefresh={refresh}
      header={
        <HeaderBand
          title={t('closing.title')}
          subtitle={preview.data ? dates.day(preview.data.business_date, 'EEEE d MMMM') : undefined}
          onBack
        />
      }
    >
      <QueryState query={preview}>
        {(p) => {
          const status = p.closing?.status ?? 'open';
          const counting = status === 'open' || status === 'draft';
          return (
            <View style={styles.body}>
              <ExpectedCard preview={p} />
              {p.closing?.returned_reason && status === 'draft' ? (
                <Card variant="outlined" style={styles.card}>
                  <StatusPill tone="warning" label={t('closing.sentBack')} />
                  <Text testID="closing-returned">{t('closing.sentBackBecause', { reason: p.closing.returned_reason })}</Text>
                </Card>
              ) : null}
              {counting && p.is_today && can(role, 'payTips') && p.tips_owed.length > 0 ? <TipsCard tips={p.tips_owed} /> : null}
              {counting && can(role, 'countCash') ? (
                <View style={styles.block}>
                  <SectionHeader title={t('closing.count')} />
                  <CountForm key={`${p.business_date}-${p.closing?.updated_at ?? ''}`} preview={p} />
                </View>
              ) : null}
              {counting && !can(role, 'countCash') ? <Text color="textSecondary">{t('closing.notCounted')}</Text> : null}
              {!counting && p.closing ? <CloseSummary closing={p.closing} /> : null}
            </View>
          );
        }}
      </QueryState>
      {!date ? (
        <View style={[styles.block, styles.history]}>
          <SectionHeader title={t('closing.history')} />
          <QueryState
            query={history}
            isEmpty={(rows) => rows.length === 0}
            empty={<EmptyState illustration="no-results" message={t('closing.noHistory')} />}
          >
            {(rows) => (
              <View style={styles.list}>
                {rows.map((d) => {
                  const pill = HISTORY_STATUS[d.status];
                  return (
                    <ListRow
                      key={d.business_date}
                      testID={`closing-day-${d.business_date}`}
                      title={dates.day(d.business_date, 'EEE d MMM')}
                      meta={[
                        [
                          t('closing.historyExpected', { amount: formatMoney(d.expected_cash_minor) }),
                          d.counted_cash_minor !== null ? t('closing.historyCounted', { amount: formatMoney(d.counted_cash_minor) }) : null,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      ]}
                      badges={
                        pill ? <StatusPill status={pill} /> : <StatusPill tone="neutral" label={t(`closing.status.${d.status}`)} />
                      }
                      trailing={d.variance_minor !== null ? <Variance amount={d.variance_minor} /> : undefined}
                      chevron
                      onPress={() => router.push({ pathname: '/cash-closing/[date]', params: { date: d.business_date } })}
                    />
                  );
                })}
              </View>
            )}
          </QueryState>
        </View>
      ) : null}
    </Screen>
  );
}

function Variance({ amount }: { amount: number }) {
  return (
    <Text
      variant="bodyStrong"
      tabular
      color={amount === 0 ? 'textSecondary' : undefined}
      style={amount !== 0 ? { color: amount < 0 ? semantic.error.pressed : semantic.warning.pressed } : undefined}
    >
      {amount > 0 ? '+' : ''}
      {formatMoney(amount)}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  block: { gap: spacing.md },
  card: { gap: spacing.sm },
  history: { marginTop: spacing['2xl'] },
  list: { gap: spacing.sm },
});
