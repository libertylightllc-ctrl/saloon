import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { ListRow, QueryState } from '@/ui';

import { usePlatformAudit } from './api';
import { auditSentence } from './auditText';

/**
 * The platform owners' record (full update, Phase 6 g): what changed, as a sentence (final brief E2), who and when.
 * A change made by the database itself (a correction of old records) is an "Automatic update".
 */
export function AuditTab() {
  const { t } = useTranslation();
  const dates = useDates();
  const audit = usePlatformAudit();
  const say = t as (key: string, values?: Record<string, unknown>) => string;
  return (
    <QueryState query={audit} empty={t('console.audit.empty')}>
      {(rows) => (
        <View style={styles.list}>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              title={auditSentence(r, say, (d, pattern) => dates.day(d, pattern))}
              meta={[[r.actor ?? t('console.audit.system'), dates.at(r.created_at, 'Asia/Dubai', 'd MMM yyyy · HH:mm')].join(' · ')]}
              testID={`audit-${r.action}`}
            />
          ))}
        </View>
      )}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
