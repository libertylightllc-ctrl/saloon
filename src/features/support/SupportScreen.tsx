import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useContact } from '@/features/landing/contact';
import { spacing } from '@/theme';
import { Button, HeaderBand, QueryState, Screen, Text } from '@/ui';

import { useSupportMine, useSupportSend } from './api';
import { ChatView } from './ChatView';
import { CommonQuestions } from './CommonQuestions';
import { useMemberFaq } from './faqAudience';

/**
 * Help & support for anyone signed in (More → Help & support): one running conversation with Saloqo, and "Chat with us
 * on WhatsApp" when the team has a WhatsApp number (owner's console brief, Part E4), its message naming the salon and
 * its code so the team knows who it is.
 */
export function SupportScreen() {
  const { t } = useTranslation();
  const { business } = useWorkspace();
  const contact = useContact();
  const thread = useSupportMine();
  const send = useSupportSend();
  const [draft, setDraft] = useState('');
  const audience = useMemberFaq();
  return (
    <Screen header={<HeaderBand title={t('support.title')} onBack />}>
      <View style={styles.body}>
        <Text color="textSecondary">{t('support.intro')}</Text>
        <QueryState query={thread}>
          {(th) => (
            <View style={styles.body}>
              {th.status === 'closed' && th.messages.length ? (
                <Text variant="small" color="textSecondary">
                  {t('support.closed')}
                </Text>
              ) : null}
              <ChatView
                messages={th.messages}
                mine="user"
                other={t('support.team')}
                onSend={(body, done) => send.mutate(body, { onSuccess: done })}
                sending={send.isPending}
                error={send.error}
                beforeComposer={<CommonQuestions query={draft} browse={th.messages.length === 0} audience={audience} />}
                onDraftChange={setDraft}
                testID="support"
              />
            </View>
          )}
        </QueryState>
        <Text variant="small" color="textSecondary">
          {t('support.attached')}
        </Text>
        {contact.hasWhatsApp ? (
          <Button
            label={t('support.whatsapp')}
            icon="messageCircle"
            variant="secondary"
            onPress={() =>
              void Linking.openURL(
                contact.whatsappUrl(t('support.whatsappHelp', { salon: business.name, code: business.code })),
              )
            }
            testID="support-whatsapp"
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
