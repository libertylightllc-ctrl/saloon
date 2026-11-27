import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { deviceTimeZone } from '@/features/setup/CountryStep';
import {
  useSetSupportAssistant,
  useSupportAssistant,
  useSupportInbox,
  type SupportThreadRow,
} from '@/features/support/adminApi';
import { replyLine, STAGE_TONE, STAGES, stageCounts, type Stage } from '@/features/support/stage';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { BottomSheet, Chip, EmptyState, ListRow, QueryState, StatusPill, SwitchRow, Text } from '@/ui';

import { SupportConversation } from './SupportConversation';

/**
 * Help & support messages from salons and visitors (2026-10-12): who wrote, from where, and the conversation. Each
 * has a status (owner's brief, Part E1): Waiting for you first, with a filter and a count for each.
 */
export function SupportTab() {
  const { t } = useTranslation();
  const inbox = useSupportInbox();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Stage | 'all'>('all');
  const assistant = useSupportAssistant();
  const setAssistant = useSetSupportAssistant();
  // The open conversation as the inbox has it now (its status changes while it is open).
  const open = (inbox.data ?? []).find((r) => r.id === openId) ?? null;
  return (
    <>
      <SwitchRow
        label={t('console.support.assistantSwitch')}
        hint={t('console.support.assistantHint')}
        value={assistant.data ?? true}
        onChange={(on) => setAssistant.mutate(on)}
        testID="console-support-assistant"
      />
      <QueryState
        query={inbox}
        isEmpty={(rows) => rows.length === 0}
        empty={<EmptyState illustration="no-results" message={t('console.support.empty')} />}
      >
        {(rows) => {
          const counts = stageCounts(rows);
          const shown = filter === 'all' ? rows : rows.filter((r) => r.stage === filter);
          return (
            <View style={styles.list}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                <Chip
                  label={`${t('console.support.all')} (${rows.length})`}
                  selected={filter === 'all'}
                  onPress={() => setFilter('all')}
                  testID="console-support-filter-all"
                />
                {STAGES.map((s) => (
                  <Chip
                    key={s}
                    label={`${t(`console.support.stage.${s}`)} (${counts[s]})`}
                    selected={filter === s}
                    onPress={() => setFilter(s)}
                    testID={`console-support-filter-${s}`}
                  />
                ))}
              </ScrollView>
              {shown.length === 0 ? (
                <Text color="textSecondary">{t('console.support.noneHere')}</Text>
              ) : null}
              {shown.map((r) => (
                <Row key={r.id} r={r} onPress={() => setOpenId(r.id)} />
              ))}
            </View>
          );
        }}
      </QueryState>
      <BottomSheet
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open?.who ?? open?.email ?? t('console.support.someone')}
        snapPoints={['90%']}
      >
        {open ? <SupportConversation row={open} onDone={() => setOpenId(null)} /> : null}
      </BottomSheet>
    </>
  );
}

function Row({ r, onPress }: { r: SupportThreadRow; onPress: () => void }) {
  const { t } = useTranslation();
  const dates = useDates();
  return (
    <ListRow
      testID={`support-thread-${r.salon_code ?? r.email ?? r.id}`}
      title={r.who ?? r.email ?? t('console.support.someone')}
      meta={[
        r.salon ? `${r.salon} · ${r.salon_code}` : t('console.support.visitor'),
        ...(r.email ? [r.email] : []),
        ...(r.preview ? [r.preview] : []),
        [r.context.platform, r.context.version && `v${r.context.version}`, r.context.screen]
          .filter(Boolean)
          .join(' · '),
        [
          dates.at(r.last_message_at, deviceTimeZone() ?? 'UTC', 'd MMM yyyy · HH:mm'),
          ...replyLine(t, r),
        ].join(' · '),
      ]}
      badges={
        <View style={styles.badges}>
          <StatusPill tone={STAGE_TONE[r.stage]} label={t(`console.support.stage.${r.stage}`)} />
          {r.unread ? (
            <StatusPill
              status="pending_approval"
              label={t('console.support.new', { count: r.unread })}
            />
          ) : null}
          {r.last_from === 'assistant' && r.stage === 'waiting_salon' ? (
            <StatusPill status="valid" label={t('console.support.aiAnswered')} />
          ) : null}
        </View>
      }
      chevron
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  chips: { gap: spacing.xs, paddingVertical: spacing.xs },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
});
