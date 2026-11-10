import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, Card, FormError, SectionHeader, Text, TextField, useToast } from '@/ui';

import { useAddServiceNote, type ServiceNote } from './api';

/**
 * Service notes: short notes on the client's visits (colour formula, what was done), newest first, with who wrote them.
 * The customer book's users add them for anyone; a stylist for their own clients.
 */
export function ServiceNotes({ customerId, notes, canAdd }: { customerId: string; notes: ServiceNote[]; canAdd: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useDates();
  const { business, branch } = useWorkspace();
  const add = useAddServiceNote(business.id, branch.id);
  const [note, setNote] = useState('');

  return (
    <View style={styles.block}>
      <SectionHeader title={t('customers.serviceNotes.title')} />
      {notes.length === 0 ? <Text color="textSecondary">{t('customers.serviceNotes.none')}</Text> : null}
      {notes.map((n) => (
        <Card key={n.id} variant="outlined" style={styles.note} testID="service-note">
          <Text>{n.note}</Text>
          <Text variant="small" color="textSecondary">
            {t('customers.serviceNotes.by', {
              name: n.author_name,
              date: dates.at(new Date(n.created_at), business.timezone, 'd MMM yyyy'),
            })}
          </Text>
        </Card>
      ))}
      {canAdd ? (
        <View style={styles.add}>
          <TextField
            label={t('customers.serviceNotes.add')}
            hint={t('customers.serviceNotes.hint')}
            value={note}
            onChangeText={setNote}
            maxLength={500}
            multiline
            testID="service-note-input"
          />
          <FormError error={add.error} />
          <View style={styles.row}>
            <Button
              label={t('customers.serviceNotes.save')}
              size="md"
              variant="secondary"
              disabled={note.trim().length === 0}
              loading={add.isPending}
              onPress={() =>
                add.mutate(
                  { customerId, note: note.trim() },
                  {
                    onSuccess: () => {
                      setNote('');
                      toast(t('customers.serviceNotes.saved'));
                    },
                  },
                )
              }
              testID="service-note-save"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  note: { gap: spacing.xs },
  add: { gap: spacing.sm },
  row: { flexDirection: 'row' },
});
