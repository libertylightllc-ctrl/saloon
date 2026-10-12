import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  useSupportClose,
  useSupportInbox,
  useSupportReply,
  useSupportThreadAdmin,
  type SupportThreadRow,
} from '@/features/support/api';
import { ChatView } from '@/features/support/ChatView';
import { deviceTimeZone } from '@/features/setup/CountryStep';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import {
  BottomSheet,
  Button,
  EmptyState,
  ListRow,
  QueryState,
  StatusPill,
  Text,
  useToast,
} from '@/ui';

/** Help & support messages from salons and visitors (2026-10-12): who wrote, from where, and the conversation. */
export function SupportTab() {
  const { t } = useTranslation();
  const dates = useDates();
  const inbox = useSupportInbox();
  const [open, setOpen] = useState<SupportThreadRow | null>(null);
  return (
    <>
      <QueryState
        query={inbox}
        isEmpty={(rows) => rows.length === 0}
        empty={<EmptyState illustration="no-results" message={t('console.support.empty')} />}
      >
        {(rows) => (
          <View style={styles.list}>
            {rows.map((r) => (
              <ListRow
                key={r.id}
                testID={`support-thread-${r.salon_code ?? r.email ?? r.id}`}
                title={r.who ?? r.email ?? t('console.support.someone')}
                meta={[
                  r.salon ? `${r.salon} · ${r.salon_code}` : t('console.support.visitor'),
                  ...(r.email ? [r.email] : []),
                  ...(r.preview ? [r.preview] : []),
                  [
                    r.context.platform,
                    r.context.version && `v${r.context.version}`,
                    r.context.screen,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  dates.at(r.last_message_at, deviceTimeZone() ?? 'UTC', 'd MMM yyyy · HH:mm'),
                ]}
                badges={
                  <View style={styles.badges}>
                    {r.unread ? (
                      <StatusPill
                        status="pending_approval"
                        label={t('console.support.new', { count: r.unread })}
                      />
                    ) : null}
                    {r.status === 'closed' ? (
                      <StatusPill status="cancelled" label={t('console.support.closed')} />
                    ) : null}
                  </View>
                }
                chevron
                onPress={() => setOpen(r)}
              />
            ))}
          </View>
        )}
      </QueryState>
      <BottomSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.who ?? open?.email ?? t('console.support.someone')}
        snapPoints={['90%']}
      >
        {open ? <Conversation row={open} onDone={() => setOpen(null)} /> : null}
      </BottomSheet>
    </>
  );
}

function Conversation({ row, onDone }: { row: SupportThreadRow; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const thread = useSupportThreadAdmin(row.id);
  const reply = useSupportReply();
  const close = useSupportClose();
  return (
    <View style={styles.sheet}>
      <Text variant="small" color="textSecondary" selectable>
        {[
          row.salon ? `${row.salon} · ${row.salon_code}` : t('console.support.visitor'),
          row.role,
          row.email,
          row.context.device,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <QueryState query={thread}>
        {(th) => (
          <ChatView
            messages={th.messages}
            mine="support"
            other={row.who ?? row.email ?? t('console.support.someone')}
            sendLabel={t('console.support.send')}
            onSend={(body, done) =>
              reply.mutate(
                { thread: row.id, body },
                {
                  onSuccess: () => {
                    done();
                    toast(t('console.support.sent'));
                  },
                },
              )
            }
            sending={reply.isPending}
            error={reply.error}
            testID="console-support"
          />
        )}
      </QueryState>
      {row.status === 'open' ? (
        <Button
          label={t('console.support.close')}
          variant="ghost"
          loading={close.isPending}
          onPress={() =>
            close.mutate(row.id, {
              onSuccess: () => {
                toast(t('console.support.closedToast'));
                onDone();
              },
            })
          }
          testID="console-support-close"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  sheet: { gap: spacing.lg },
});
