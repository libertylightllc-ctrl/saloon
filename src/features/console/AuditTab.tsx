import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { ListRow, QueryState } from '@/ui';

import { usePlatformAudit } from './api';

const show = (v: Record<string, unknown> | null) =>
  v ? Object.entries(v).map(([k, x]) => `${k}: ${x === null ? '—' : String(x)}`).join(', ') : '—';

/** The platform owners' record (full update, Phase 6 g): who changed what, when, the old and the new value. */
export function AuditTab() {
  const { t } = useTranslation();
  const dates = useDates();
  const audit = usePlatformAudit();
  return (
    <QueryState query={audit} empty={t('console.audit.empty')}>
      {(rows) => (
        <View style={styles.list}>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              title={[r.action, r.salon ?? r.subject].filter(Boolean).join(' · ')}
              meta={[
                t('console.audit.change', { before: show(r.before), after: show(r.after) }),
                [r.actor ?? '—', dates.at(r.created_at, 'Asia/Dubai', 'd MMM yyyy · HH:mm')].join(' · '),
              ]}
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
