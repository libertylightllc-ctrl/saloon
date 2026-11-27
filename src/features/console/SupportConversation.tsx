import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSupportReply, useSupportThreadAdmin, type SupportThreadRow } from '@/features/support/adminApi';
import { ChatView } from '@/features/support/ChatView';
import { replyLine, STAGE_TONE } from '@/features/support/stage';
import { spacing } from '@/theme';
import { QueryState, StatusPill, Text, useToast } from '@/ui';

import { SupportStatusActions } from './SupportStatusActions';

/** One conversation in the console: who wrote and from where, its status, the messages and the answer box. */
export function SupportConversation({ row, onDone }: { row: SupportThreadRow; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const thread = useSupportThreadAdmin(row.id);
  const reply = useSupportReply();
  return (
    <View style={styles.sheet}>
      <Text variant="small" color="textSecondary" selectable>
        {[row.salon ? `${row.salon} · ${row.salon_code}` : t('console.support.visitor'), row.role, row.email, row.context.device]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <View style={styles.status} testID="console-support-stage">
        <StatusPill tone={STAGE_TONE[row.stage]} label={t(`console.support.stage.${row.stage}`)} />
        <Text variant="small" color="textSecondary" testID="console-support-reply-time">
          {replyLine(t, row).join(' · ')}
        </Text>
      </View>
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
      <SupportStatusActions row={row} onDone={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.lg },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
