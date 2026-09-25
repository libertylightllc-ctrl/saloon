import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney, sum } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { EmptyState, ListRow, QueryState, Text } from '@/ui';

import { useJournal } from './api';
import { useLedgerLabels } from './labels';

/** Latest journal entries; tap one to see its debit and credit lines. */
export function JournalTab() {
  const { t } = useTranslation();
  const dates = useDates();
  const labels = useLedgerLabels();
  const { business } = useWorkspace();
  const journal = useJournal(business.id);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <QueryState
      query={journal}
      isEmpty={(rows) => rows.length === 0}
      empty={<EmptyState illustration="no-results" message={t('accounts.noJournal')} />}
    >
      {(rows) => (
        <View style={styles.list}>
          {rows.map((e) => {
            const amount = sum(e.journal_lines.map((l) => Number(l.debit_minor)));
            const lines = [...e.journal_lines].sort((a, b) => Number(b.debit_minor) - Number(a.debit_minor));
            return (
              <ListRow
                key={e.id}
                testID={`journal-${e.source_type}`}
                title={e.memo ?? labels.source(e.source_type)}
                meta={[`${labels.source(e.source_type)} · ${dates.day(e.business_date, 'd MMM yyyy')}`]}
                trailing={
                  <Text variant="bodyStrong" tabular>
                    {formatMoney(amount)}
                  </Text>
                }
                onPress={() => setOpen(open === e.id ? null : e.id)}
                footer={
                  open === e.id ? (
                    <View style={styles.lines}>
                      <View style={styles.line}>
                        <Text variant="small" color="textSecondary" style={styles.flex}>
                          {t('accounts.account')}
                        </Text>
                        <Text variant="small" color="textSecondary" align="end" style={styles.money}>
                          {t('accounts.debit')}
                        </Text>
                        <Text variant="small" color="textSecondary" align="end" style={styles.money}>
                          {t('accounts.credit')}
                        </Text>
                      </View>
                      {lines.map((l, i) => (
                        <View key={i} style={styles.line} testID="journal-line">
                          <Text variant="small" style={styles.flex}>
                            {l.accounts ? labels.account(l.accounts) : '—'}
                          </Text>
                          <Text variant="small" tabular align="end" style={styles.money}>
                            {Number(l.debit_minor) ? formatMoney(Number(l.debit_minor)) : ''}
                          </Text>
                          <Text variant="small" tabular align="end" style={styles.money}>
                            {Number(l.credit_minor) ? formatMoney(Number(l.credit_minor)) : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : undefined
                }
              />
            );
          })}
        </View>
      )}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  lines: { gap: spacing.xs, flex: 1, alignSelf: 'stretch' },
  line: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
  money: { width: 88 },
});
