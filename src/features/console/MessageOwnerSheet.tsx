import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { isRtlLanguage } from '@/lib/i18n';
import { spacing } from '@/theme';
import { BottomSheet, Button, Card, FormError, QueryState, Text, useToast } from '@/ui';

import { emailUrl, languageName, ownerMessage, whatsappUrl } from './ownerMessage';
import { useLogContact, type EndingSalon } from './overviewApi';

/**
 * B6 "Message owner" (owner's brief, Part B): the note in the owner's language, to read before it opens. Opening
 * WhatsApp or email is first saved in Changes and in the salon's history; if that fails, nothing opens.
 */
export function MessageOwnerSheet({ salon, onClose }: { salon: EndingSalon | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={salon !== null} onClose={onClose} title={t('console.comingUp.messageTitle')}>
      {salon ? <Body salon={salon} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function Body({ salon: s, onClose }: { salon: EndingSalon; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const log = useLogContact();
  const message = useQuery({
    queryKey: ['owner-message', s.business_id, s.status, s.ends_on, s.owner_name, s.language],
    queryFn: () => ownerMessage(s),
    staleTime: Infinity,
  });
  const send = async (channel: 'whatsapp' | 'email', url: string) => {
    try {
      await log.mutateAsync({ business: s.business_id, channel });
    } catch {
      return; // shown below
    }
    await Linking.openURL(url);
    toast(t('console.comingUp.logged'));
    onClose();
  };
  return (
    <QueryState query={message}>
      {(m) => (
        <View style={styles.body} testID="console-message-sheet">
          <Text color="textSecondary">
            {t('console.comingUp.messageTo', { salon: s.name, language: languageName(m.language) })}
          </Text>
          <Card variant="outlined">
            {/* In the owner's language, whatever the console's: Arabic and Urdu read right to left. */}
            <Text selectable style={isRtlLanguage(m.language) ? styles.rtl : styles.ltr} testID="console-message-text">
              {m.text}
            </Text>
          </Card>
          <FormError error={log.error} />
          <View style={styles.actions}>
            {s.whatsapp ? (
              <Button
                label={t('console.comingUp.openWhatsapp')}
                icon="messageCircle"
                loading={log.isPending}
                onPress={() => void send('whatsapp', whatsappUrl(s.whatsapp!, m.text))}
                testID="console-message-whatsapp"
              />
            ) : null}
            {s.email ? (
              <Button
                label={t('console.comingUp.openEmail')}
                icon="mail"
                variant={s.whatsapp ? 'outline' : 'primary'}
                loading={log.isPending}
                onPress={() => void send('email', emailUrl(s.email!, m.subject, m.text))}
                testID="console-message-email"
              />
            ) : null}
          </View>
          <Text variant="small" color="textSecondary">
            {s.whatsapp ? t('console.comingUp.whatsappOk') : t('console.comingUp.noWhatsapp')} {t('console.comingUp.logNote')}
          </Text>
        </View>
      )}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
});
