import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatDuration } from '@/lib/duration';
import { spacing } from '@/theme';
import { KpiCard, KpiGrid, QueryState, SectionHeader } from '@/ui';

import { HealthCard } from './HealthCard';
import { useHealth, useSupportStats, type SupportStats } from './overviewApi';

/**
 * The Overview's last part (owner's brief, Part B): B9 support conversations and how fast a person answers, and B10
 * whether the automatic work (emails, card payments, exchange rates, the app itself) is running.
 */
export function ServiceSection({ onOpenSupport }: { onOpenSupport: () => void }) {
  const { t } = useTranslation();
  const support = useSupportStats();
  const health = useHealth();
  return (
    <View style={styles.body}>
      <SectionHeader title={t('console.service.title')} />
      <QueryState query={support}>{(s) => <SupportCard s={s} onPress={onOpenSupport} />}</QueryState>
      <QueryState query={health}>{(h) => <HealthCard health={h} />}</QueryState>
    </View>
  );
}

function SupportCard({ s, onPress }: { s: SupportStats; onPress: () => void }) {
  const { t } = useTranslation();
  const minutes = (m: number) => (m < 1 ? t('console.support.underMinute') : formatDuration(t, m));
  return (
    <KpiGrid>
      <KpiCard
        icon="messageCircle"
        label={t('console.support.waiting')}
        value={String(s.waiting)}
        sub={[
          t('console.support.open', { n: s.open }),
          ...(s.oldest_waiting_minutes !== null ? [t('console.support.oldest', { time: minutes(s.oldest_waiting_minutes) })] : []),
        ].join('\n')}
        subLines={3}
        onPress={onPress}
        testID="console-support"
      />
      <KpiCard
        icon="timer"
        label={t('console.support.firstReply')}
        value={s.first_reply_seconds === null ? '—' : minutes(Math.round(s.first_reply_seconds / 60))}
        sub={t('console.support.firstReplySub', { n: s.replied_30d })}
        subLines={3}
        onPress={onPress}
        testID="console-first-reply"
      />
    </KpiGrid>
  );
}

const styles = StyleSheet.create({ body: { gap: spacing.md } });
