import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { businessMonth } from '@/lib/dates';
import { fileSlug, shareCsv } from '@/lib/exportFile';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { BottomSheet, Button, EmptyState, FormError, HeaderBand, ListRow, QueryState, Screen, StatusPill, Text, TextField, useToast } from '@/ui';

import { ledgerRows, usePeriodAction, usePeriods, type Period } from './periods';

/** Close month: lock a finished month so nothing more can be posted into it; reopen with a reason. */
export function ClosePeriodScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useDates();
  const { business, role } = useWorkspace();
  const periods = usePeriods(business.id);
  const action = usePeriodAction(business.id);
  const owner = can(role, 'closePeriod');
  const thisMonth = businessMonth(new Date(), business.timezone);
  const [open, setOpen] = useState<{ period: Period; action: 'close' | 'reopen' } | null>(null);
  const [reason, setReason] = useState('');
  const monthName = (m: string) => dates.day(`${m}-01`, 'MMMM yyyy');
  const ledger = useMutation({
    mutationFn: async () => {
      const rows = await ledgerRows(business.id, [
        t('accounts.csv.date'), t('accounts.csv.source'), t('accounts.csv.memo'), t('accounts.csv.code'),
        t('accounts.csv.account'), t('accounts.debit'), t('accounts.credit'),
      ]);
      await shareCsv(`${fileSlug(business.name)}-ledger`, rows, t('accounts.exportLedger'));
      return rows.length - 1;
    },
    onSuccess: (n) => toast(t('accounts.ledgerExported', { count: n })),
  });

  const submit = () => {
    if (!open) return;
    action.mutate(
      { month: open.period.month, action: open.action, reason },
      {
        onSuccess: () => {
          toast(t(open.action === 'close' ? 'accounts.period.closedToast' : 'accounts.period.reopenedToast', { month: monthName(open.period.month) }));
          setOpen(null);
        },
      },
    );
  };

  return (
    <>
      <Screen
        refreshing={periods.isRefetching}
        onRefresh={() => void periods.refetch()}
        header={<HeaderBand title={t('accounts.period.title')} subtitle={t('accounts.period.subtitle')} onBack />}
        footer={<Button label={t('accounts.exportLedger')} icon="download" variant="outline" loading={ledger.isPending} onPress={() => ledger.mutate()} testID="ledger-csv" />}
      >
        <View style={styles.body}>
          <FormError error={ledger.error} />
          <QueryState query={periods} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('accounts.period.empty')} />}>
            {(rows) => (
              <View style={styles.list}>
                {rows.map((p) => {
                  const finished = p.month < thisMonth;
                  return (
                    <ListRow
                      key={p.month}
                      testID={`period-${p.month}`}
                      title={monthName(p.month)}
                      meta={[
                        t('accounts.period.entries', { count: p.entries }),
                        ...(p.status === 'closed' && p.closed_at
                          ? [t('accounts.period.closedBy', { name: p.closed_by ?? '', date: dates.at(p.closed_at, business.timezone, 'd MMM yyyy') })]
                          : []),
                      ]}
                      badges={<StatusPill status={p.status === 'closed' ? 'paid' : 'due_soon'} label={t(`accounts.period.status.${p.status}`)} />}
                      trailing={
                        owner && (p.status === 'closed' || finished) ? (
                          <Button
                            label={t(p.status === 'closed' ? 'accounts.period.reopen' : 'accounts.period.close')}
                            variant={p.status === 'closed' ? 'outline' : 'row'}
                            size="sm"
                            icon={p.status === 'closed' ? 'rotate' : 'lock'}
                            onPress={() => {
                              action.reset();
                              setReason('');
                              setOpen({ period: p, action: p.status === 'closed' ? 'reopen' : 'close' });
                            }}
                            testID={`period-${p.month}-${p.status === 'closed' ? 'reopen' : 'close'}`}
                          />
                        ) : undefined
                      }
                    />
                  );
                })}
                <Text variant="small" color="textSecondary">
                  {t('accounts.period.hint')}
                </Text>
              </View>
            )}
          </QueryState>
        </View>
      </Screen>
      <BottomSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? t(open.action === 'close' ? 'accounts.period.closeTitle' : 'accounts.period.reopenTitle', { month: monthName(open.period.month) }) : ''}
      >
        {open ? (
          <View style={styles.sheet}>
            <Text color="textSecondary">{t(open.action === 'close' ? 'accounts.period.closeBody' : 'accounts.period.reopenBody')}</Text>
            {open.action === 'reopen' ? (
              <TextField label={t('accounts.period.reason')} value={reason} onChangeText={setReason} testID="period-reason" />
            ) : null}
            <FormError error={action.error} />
            <Button
              label={t(open.action === 'close' ? 'accounts.period.confirmClose' : 'accounts.period.confirmReopen')}
              variant={open.action === 'close' ? 'primary' : 'danger'}
              loading={action.isPending}
              onPress={submit}
              testID="period-confirm"
            />
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  list: { gap: spacing.sm },
  sheet: { gap: spacing.lg },
});
