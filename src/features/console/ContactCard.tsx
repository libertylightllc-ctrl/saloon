import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { useContactSetting, type ContactSetting } from '@/features/landing/contact';
import { spacing } from '@/theme';
import { Button, Card, FormError, QueryState, Text, TextField, useToast } from '@/ui';

import { useSetContact } from './api';

/** As the database keeps it: spaces, brackets, dots and dashes go, a leading 00 becomes +. */
export const tidyNumber = (v: string) => v.replace(/[\s().-]/g, '').replace(/^00/, '+');
export const numberOk = (v: string) => tidyNumber(v) === '' || /^\+[1-9]\d{7,14}$/.test(tidyNumber(v));

/**
 * Contact (owner's fix list A4): the WhatsApp number every "WhatsApp us" link opens (the app and the website) and the
 * message it starts with. An empty number hides them all. Each change shows in Changes.
 */
export function ContactCard() {
  const setting = useContactSetting();
  return <QueryState query={setting}>{(c) => <ContactForm c={c} />}</QueryState>;
}

function ContactForm({ c }: { c: ContactSetting }) {
  const { t } = useTranslation();
  const toast = useToast();
  const set = useSetContact();
  const [number, setNumber] = useState(c.whatsapp_number);
  const [message, setMessage] = useState(c.whatsapp_message);
  const wrong = !numberOk(number);

  return (
    <Card variant="outlined" style={styles.card} testID="console-contact">
      <Text variant="h4">{t('console.contact.title')}</Text>
      <TextField
        label={t('console.contact.number')}
        hint={t('console.contact.numberHint')}
        error={wrong ? t('console.contact.numberWrong') : undefined}
        value={number}
        onChangeText={setNumber}
        keyboardType="phone-pad"
        autoComplete="off"
        placeholder="+971 50 123 4567"
        testID="console-whatsapp-number"
      />
      <TextField
        label={t('console.contact.message')}
        hint={t('console.contact.messageHint')}
        value={message}
        onChangeText={setMessage}
        maxLength={300}
        multiline
        testID="console-whatsapp-message"
      />
      <FormError error={set.error} />
      <Button
        label={t('common.save')}
        disabled={wrong}
        loading={set.isPending}
        onPress={() =>
          set.mutate(
            { number, message },
            {
              onSuccess: (saved) => {
                setNumber(saved.whatsapp_number);
                setMessage(saved.whatsapp_message);
                toast(t('console.access.saved'));
              },
            },
          )
        }
        testID="console-contact-save"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
