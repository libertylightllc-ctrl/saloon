import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatBusinessDate } from '@/lib/dates';
import { spacing } from '@/theme';
import { Button, ListRow, QueryState, SectionHeader, Text } from '@/ui';

import { MessageOwnerSheet } from './MessageOwnerSheet';
import { languageName } from './ownerMessage';
import { useComingUp, type EndingSalon, type WaitingRequest } from './overviewApi';
import { useConsoleTime } from './zone';

const SHOWN = 5;

/**
 * B6 Coming up (owner's brief, Part B): free periods and pilots ending in the next 7 days, with Extend (the salon's
 * access form in Salons) and Message owner; and plan requests still waiting, with how long. A row opens its salon.
 */
export function ComingUp({ onOpenSalon }: { onOpenSalon: (code: string) => void }) {
  const { t } = useTranslation();
  const query = useComingUp();
  const [messaging, setMessaging] = useState<EndingSalon | null>(null);
  return (
    <View style={styles.body} testID="console-coming-up">
      <SectionHeader title={t('console.comingUp.title')} />
      <QueryState query={query}>
        {(c) => (
          <>
            <Ending rows={c.ending} onOpenSalon={onOpenSalon} onMessage={setMessaging} />
            <Requests rows={c.requests} onOpenSalon={onOpenSalon} />
          </>
        )}
      </QueryState>
      <MessageOwnerSheet salon={messaging} onClose={() => setMessaging(null)} />
    </View>
  );
}

function ShowAll({ total, open, onPress, testID }: { total: number; open: boolean; onPress: () => void; testID: string }) {
  const { t } = useTranslation();
  if (total <= SHOWN || open) return null;
  return <Button label={t('console.comingUp.showAll', { n: total })} variant="ghost" size="sm" onPress={onPress} testID={testID} />;
}

function Ending({ rows, onOpenSalon, onMessage }: { rows: EndingSalon[]; onOpenSalon: (code: string) => void; onMessage: (s: EndingSalon) => void }) {
  const { t, i18n } = useTranslation();
  const time = useConsoleTime();
  const [all, setAll] = useState(false);
  return (
    <View style={styles.group}>
      <Text variant="bodyStrong">{t('console.comingUp.ending', { n: rows.length })}</Text>
      {rows.length === 0 ? <Text color="textSecondary">{t('console.comingUp.endingNone')}</Text> : null}
      {(all ? rows : rows.slice(0, SHOWN)).map((s) => {
        const date = formatBusinessDate(s.ends_on, 'd MMM yyyy', i18n.language);
        return (
          <ListRow
            key={s.business_id}
            title={s.name}
            testID={`console-ending-${s.code}`}
            meta={[
              [t(`console.status.${s.status}`), s.days_left === 0 ? t('console.comingUp.endsToday') : t('console.comingUp.endsOn', { count: s.days_left, date })].join(' · '),
              [s.owner_name ?? t('console.comingUp.noName'), languageName(s.language)].join(' · '),
              s.whatsapp ? t('console.comingUp.whatsapp', { phone: s.whatsapp }) : (s.email ?? t('console.comingUp.noContact')),
              ...(s.contacted_at ? [t('console.comingUp.messaged', { when: time.mine(s.contacted_at) })] : []),
            ]}
            footer={
              <View style={styles.actions}>
                <Button label={t('console.comingUp.extend')} variant="secondary" size="sm" onPress={() => onOpenSalon(s.code)} testID={`console-extend-${s.code}`} />
                {s.whatsapp || s.email ? (
                  <Button label={t('console.comingUp.messageOwner')} variant="outline" size="sm" icon="messageCircle" onPress={() => onMessage(s)} testID={`console-message-${s.code}`} />
                ) : null}
              </View>
            }
          />
        );
      })}
      <ShowAll total={rows.length} open={all} onPress={() => setAll(true)} testID="console-ending-all" />
    </View>
  );
}

function Requests({ rows, onOpenSalon }: { rows: WaitingRequest[]; onOpenSalon: (code: string) => void }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  return (
    <View style={styles.group}>
      <Text variant="bodyStrong">{t('console.comingUp.requests', { n: rows.length })}</Text>
      {rows.length === 0 ? <Text color="textSecondary">{t('console.comingUp.requestsNone')}</Text> : null}
      {(all ? rows : rows.slice(0, SHOWN)).map((r) => (
        <ListRow
          key={r.business_id}
          title={r.name}
          testID={`console-request-${r.code}`}
          meta={[
            [
              t('console.comingUp.waiting', { count: r.waiting_days }),
              r.months ? t('console.plans.months', { count: r.months }) : null,
              r.times > 1 ? t('console.comingUp.askedTimes', { n: r.times }) : null,
            ]
              .filter(Boolean)
              .join(' · '),
            r.code,
          ]}
          chevron
          onPress={() => onOpenSalon(r.code)}
        />
      ))}
      <ShowAll total={rows.length} open={all} onPress={() => setAll(true)} testID="console-requests-all" />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  group: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
