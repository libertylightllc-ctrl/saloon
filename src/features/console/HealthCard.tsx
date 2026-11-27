import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { formatBusinessDate } from '@/lib/dates';
import { supabaseUrl } from '@/lib/supabase';
import { spacing, type Tone } from '@/theme';
import { Button, Card, StatusPill, Text } from '@/ui';

import type { Health, HealthLine } from './overviewApi';
import { useConsoleTime } from './zone';

/** The database's backups page for the hosted project (the project is named in the address the app already uses). */
export function backupsUrl(url: string): string {
  const host = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url);
  return host ? `https://supabase.com/dashboard/project/${host[1]}/database/backups/scheduled` : 'https://supabase.com/dashboard';
}

const failing = (l: HealthLine) => l.fails_24h > 0 || (l.last_fail_at !== null && (l.last_ok_at === null || l.last_fail_at > l.last_ok_at));

type Line = 'email' | 'card_webhook' | 'rates';
/** Before the first try there is nothing to judge (owner's brief, item 7): said as what has not happened yet. */
const NOTHING = {
  email: 'console.health.nothingSent',
  card_webhook: 'console.health.nothingReceived',
  rates: 'console.health.nothingFetched',
} as const;

/** Problem, Working, or "Nothing sent yet" until the first email (the first card notice, the first rates). */
export function healthPill(
  key: Line,
  l: HealthLine,
): { tone: Tone; label: 'console.health.problem' | 'console.health.ok' | (typeof NOTHING)[Line] } {
  if (failing(l)) return { tone: 'warning', label: 'console.health.problem' };
  if (l.last_ok_at) return { tone: 'success', label: 'console.health.ok' };
  return { tone: 'neutral', label: NOTHING[key] };
}

/**
 * B10 System health (owner's brief, Part B): emails the service sends, Creem's card-payment notices, the daily exchange
 * rates, and errors people met in the app, each with the last success and the last failure (and why). Backups are
 * on Supabase's own page. Sign-up and password emails are sent by Supabase itself, so they are not seen here.
 */
export function HealthCard({ health: h }: { health: Health }) {
  const { t, i18n } = useTranslation();
  const time = useConsoleTime();
  const line = (key: Line, title: string, extra?: string) => {
    const l = h[key];
    const bad = failing(l);
    const pill = healthPill(key, l);
    return (
      <View style={styles.line} testID={`console-health-${key}`}>
        <View style={styles.head}>
          <Text variant="bodyStrong" style={styles.title}>
            {title}
          </Text>
          <StatusPill tone={pill.tone} label={t(pill.label)} />
        </View>
        {extra ? (
          <Text variant="small" color="textSecondary">
            {extra}
          </Text>
        ) : null}
        {l.last_ok_at || l.last_fail_at ? (
          <Text variant="small" color="textSecondary">
            {[
              t('console.health.day', { ok: l.ok_24h, fails: l.fails_24h }),
              l.last_ok_at ? t('console.health.lastOk', { when: time.mine(l.last_ok_at) }) : t('console.health.neverOk'),
            ].join(' · ')}
          </Text>
        ) : null}
        {l.last_fail_at ? (
          <Text variant="small" color={bad ? 'text' : 'textSecondary'}>
            {t('console.health.lastFail', { when: time.mine(l.last_fail_at), why: l.last_fail ?? '—' })}
          </Text>
        ) : null}
      </View>
    );
  };
  return (
    <Card variant="outlined" style={styles.card} testID="console-health">
      <Text variant="h4">{t('console.health.title')}</Text>
      {line('email', t('console.health.email'), t('console.health.emailNote'))}
      {line('card_webhook', t('console.health.cards'), t('console.health.cardsMode', { mode: t(`console.cards.modes.${h.card_payments}`) }))}
      {line('rates', t('console.health.rates'), h.rates_day ? t('console.health.ratesDay', { date: formatBusinessDate(h.rates_day, 'd MMM yyyy', i18n.language) }) : t('console.health.ratesFixed'))}
      <View style={styles.line} testID="console-health-app">
        <View style={styles.head}>
          <Text variant="bodyStrong" style={styles.title}>
            {t('console.health.app')}
          </Text>
          <StatusPill tone={h.app_errors_24h > 0 ? 'warning' : 'success'} label={t('console.health.appErrors', { n: h.app_errors_24h })} />
        </View>
        {h.app_errors.map((e, i) => (
          <Text key={`${e.at}-${i}`} variant="small" color="textSecondary" numberOfLines={3}>
            {[time.mine(e.at), e.salon ?? t('console.health.noSalon'), e.screen, e.detail].filter(Boolean).join(' · ')}
          </Text>
        ))}
      </View>
      <View style={styles.line}>
        <Text variant="bodyStrong">{t('console.health.backups')}</Text>
        <Text variant="small" color="textSecondary">
          {t('console.health.backupsNote')}
        </Text>
        <View style={styles.row}>
          <Button label={t('console.health.openBackups')} variant="outline" size="sm" icon="externalLink" onPress={() => void Linking.openURL(backupsUrl(supabaseUrl))} testID="console-backups" />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  line: { gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1 },
  row: { flexDirection: 'row' },
});
