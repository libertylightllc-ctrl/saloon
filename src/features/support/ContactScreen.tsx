import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { HeaderBand, Screen, Text, TextField } from '@/ui';

import { guestToken, useGuestSend, useGuestThread } from './api';
import { ChatView } from './ChatView';

/**
 * Contact us without signing in (the website, and the sign-in screen for anyone who cannot get in). The conversation
 * stays on this device: coming back here shows the answers.
 */
export function ContactScreen() {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    void guestToken().then(setToken);
  }, []);
  const thread = useGuestThread(token);
  const send = useGuestSend(token);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const messages = thread.data?.messages ?? [];
  const started = messages.length > 0;
  return (
    <Screen header={<HeaderBand title={t('support.contactTitle')} onBack />}>
      <View style={styles.body}>
        <Text color="textSecondary">{t('support.contactIntro')}</Text>
        {!started ? (
          <>
            <TextField
              label={t('support.name')}
              value={name}
              onChangeText={setName}
              maxLength={80}
              testID="contact-name"
            />
            <TextField
              label={t('support.email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              maxLength={200}
              testID="contact-email"
            />
          </>
        ) : null}
        <ChatView
          messages={messages}
          mine="user"
          other={t('support.team')}
          sendLabel={started ? undefined : t('support.contactSend')}
          onSend={(body, done) =>
            send.mutate({ body, ...(started ? {} : { name, email }) }, { onSuccess: done })
          }
          sending={send.isPending || token === null}
          error={send.error}
          testID="contact"
        />
        <Text variant="small" color="textSecondary">
          {t('support.attachedGuest')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
