import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Avatar, EmptyState, ListRow, PillTabs, QueryState, StatusPill } from '@/ui';

import { useActivityHistory, useSignIns } from './api';

type Kind = 'activity' | 'signins';

/** Who did what (audit trail) and who signed in or out, newest first. */
export function HistoryTab() {
  const { t } = useTranslation();
  const dates = useDates();
  const { business } = useWorkspace();
  const [kind, setKind] = useState<Kind>('activity');
  const activity = useActivityHistory(business.id);
  const signIns = useSignIns(business.id);
  const when = (iso: string) => dates.at(iso, business.timezone, 'd MMM · HH:mm');

  return (
    <View style={styles.body}>
      <PillTabs<Kind>
        items={[
          { key: 'activity', label: t('accounts.activity') },
          { key: 'signins', label: t('accounts.signIns') },
        ]}
        value={kind}
        onChange={setKind}
        testID="history-kind"
      />
      {kind === 'activity' ? (
        <QueryState
          query={activity}
          isEmpty={(rows) => rows.length === 0}
          empty={<EmptyState illustration="no-results" message={t('accounts.noHistory')} />}
        >
          {(rows) => (
            <View style={styles.list}>
              {rows.map((h) => (
                <ListRow
                  key={h.id}
                  testID="history-row"
                  leading={<Avatar name={h.members?.display_name ?? '—'} size={36} />}
                  title={h.summary}
                  meta={[`${h.members?.display_name ?? t('accounts.system')} · ${when(h.created_at)}`]}
                />
              ))}
            </View>
          )}
        </QueryState>
      ) : (
        <QueryState
          query={signIns}
          isEmpty={(rows) => rows.length === 0}
          empty={<EmptyState illustration="no-results" message={t('accounts.noHistory')} />}
        >
          {(rows) => (
            <View style={styles.list}>
              {rows.map((s) => (
                <ListRow
                  key={s.id}
                  testID="signin-row"
                  leading={<Avatar name={s.members?.display_name ?? '—'} size={36} />}
                  title={s.members?.display_name ?? '—'}
                  meta={[when(s.created_at)]}
                  trailing={
                    <StatusPill
                      tone={s.event === 'sign_in' ? 'success' : 'neutral'}
                      label={t(s.event === 'sign_in' ? 'accounts.signedIn' : 'accounts.signedOut')}
                    />
                  }
                />
              ))}
            </View>
          )}
        </QueryState>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  list: { gap: spacing.sm },
});
