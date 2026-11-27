import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { waLink } from '@/features/landing/contact';
import {
  useSupportReply,
  useSupportThreadAdmin,
  useSupportWhatsApp,
  type SupportThreadRow,
} from '@/features/support/adminApi';
import { ChatView } from '@/features/support/ChatView';
import { fillReply, replyLine, STAGE_TONE } from '@/features/support/stage';
import { spacing } from '@/theme';
import { Button, FormError, QueryState, StatusPill, Text, useToast } from '@/ui';

import { SupportNotes } from './SupportNotes';
import { SupportSavedReplies } from './SupportSavedReplies';
import { SupportStatusActions } from './SupportStatusActions';

/**
 * One conversation in the console: who wrote and from where, its status, the messages and the answer box, with the
 * reply tools of the owner's brief, Part E3: saved replies, Reply on WhatsApp (only to someone who said WhatsApp is
 * OK) and internal notes.
 */
export function SupportConversation({ row, onDone }: { row: SupportThreadRow; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const thread = useSupportThreadAdmin(row.id);
  const reply = useSupportReply();
  const whatsapp = useSupportWhatsApp();
  const [draft, setDraft] = useState('');
  // The answer is kept first (marked WhatsApp, in Changes); only then does WhatsApp open with it.
  const sendOnWhatsApp = async () => {
    let phone: string;
    try {
      phone = await whatsapp.mutateAsync({ thread: row.id, body: draft });
    } catch {
      return; // shown below
    }
    await Linking.openURL(waLink(phone, draft.trim()));
    setDraft('');
    toast(t('console.support.whatsappKept'));
  };
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
          <View style={styles.sheet}>
            <ChatView
              messages={th.messages}
              mine="support"
              other={row.who ?? row.email ?? t('console.support.someone')}
              sendLabel={t('console.support.send')}
              beforeComposer={
                <SupportSavedReplies onPick={(body) => setDraft(fillReply(body, { name: row.who, salon: row.salon }))} />
              }
              draft={draft}
              onDraftChange={setDraft}
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
              actions={
                th.whatsapp ? (
                  <View style={styles.whatsapp}>
                    <Button
                      label={t('console.support.replyWhatsApp')}
                      icon="messageCircle"
                      variant="secondary"
                      disabled={!draft.trim()}
                      loading={whatsapp.isPending}
                      onPress={() => void sendOnWhatsApp()}
                      testID="console-support-whatsapp"
                    />
                    <Text variant="small" color="textSecondary">
                      {t('console.support.whatsappOk', { phone: th.whatsapp })}
                    </Text>
                    <FormError error={whatsapp.error} />
                  </View>
                ) : null
              }
              testID="console-support"
            />
            <SupportNotes thread={row.id} notes={th.notes} />
          </View>
        )}
      </QueryState>
      <SupportStatusActions row={row} onDone={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.lg },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  whatsapp: { gap: spacing.xs },
});
