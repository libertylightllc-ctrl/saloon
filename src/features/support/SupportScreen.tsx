import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { HeaderBand, QueryState, Screen, Text } from '@/ui';

import { useSupportMine, useSupportSend } from './api';
import { ChatView } from './ChatView';

/** Help & support for anyone signed in (More → Help & support): one running conversation with Saloqo. */
export function SupportScreen() {
  const { t } = useTranslation();
  const thread = useSupportMine();
  const send = useSupportSend();
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
                testID="support"
              />
            </View>
          )}
        </QueryState>
        <Text variant="small" color="textSecondary">
          {t('support.attached')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
