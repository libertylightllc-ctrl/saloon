import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { deviceTimeZone } from '@/features/setup/CountryStep';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';
import { Button, FormError, Text, TextField } from '@/ui';

import type { SupportMessage } from './api';

/**
 * A support conversation: the messages (the writer's on one side, the other side's on the other) and a box to write
 * the next one. `mine`: which author is "me" here — the person asking, or support in the console; `other`: what the
 * other side is called. Times show in this device's time zone.
 */
export function ChatView({
  messages,
  mine,
  other,
  onSend,
  sending,
  error,
  sendLabel,
  testID = 'chat',
}: {
  messages: SupportMessage[];
  mine: SupportMessage['author'];
  other: string;
  onSend: (body: string, done: () => void) => void;
  sending: boolean;
  error: unknown;
  sendLabel?: string;
  testID?: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dates = useDates();
  const [body, setBody] = useState('');
  const { colors } = theme;
  const zone = deviceTimeZone() ?? 'UTC';
  return (
    <View style={styles.chat}>
      {messages.map((m) => {
        const own = m.author === mine;
        return (
          <View key={m.id} style={[styles.row, own ? styles.own : styles.theirs]}>
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: own ? colors.primary50 : colors.surface,
                  borderColor: colors.divider,
                  borderRadius: theme.radius.md,
                },
              ]}
              testID={`${testID}-message-${m.author}`}
            >
              <Text variant="small" color="textSecondary">
                {own ? t('support.you') : other} · {dates.at(m.created_at, zone, 'd MMM · HH:mm')}
              </Text>
              <Text selectable>{m.body}</Text>
            </View>
          </View>
        );
      })}
      <TextField
        label={t('support.message')}
        placeholder={t('support.placeholder')}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
        testID={`${testID}-input`}
      />
      <FormError error={error} />
      <Button
        label={sendLabel ?? t('support.send')}
        icon="send"
        disabled={!body.trim()}
        loading={sending}
        onPress={() => onSend(body, () => setBody(''))}
        testID={`${testID}-send`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chat: { gap: spacing.md },
  row: { flexDirection: 'row' },
  own: { justifyContent: 'flex-end' },
  theirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', padding: spacing.md, gap: spacing.xs, borderWidth: 1 },
});
