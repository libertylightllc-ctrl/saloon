import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { deviceTimeZone } from '@/features/setup/CountryStep';
import { useSupportNote, type SupportNote } from '@/features/support/adminApi';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';
import { Button, FormError, Text, TextField, useToast } from '@/ui';

/** Internal notes on a conversation (owner's brief, Part E3): platform owners only; the person asking never sees them. */
export function SupportNotes({ thread, notes }: { thread: string; notes: SupportNote[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dates = useDates();
  const toast = useToast();
  const add = useSupportNote();
  const [body, setBody] = useState('');
  const zone = deviceTimeZone() ?? 'UTC';
  return (
    <View
      style={[styles.box, { backgroundColor: theme.colors.surface, borderColor: theme.colors.divider, borderRadius: theme.radius.md }]}
      testID="console-support-notes"
    >
      <Text variant="bodyStrong">{t('console.support.notes.title')}</Text>
      <Text variant="small" color="textSecondary">
        {t('console.support.notes.hint')}
      </Text>
      {notes.map((n) => (
        <View key={n.id} style={styles.note} testID="console-support-note">
          <Text variant="small" color="textSecondary">
            {n.author} · {dates.at(n.created_at, zone, 'd MMM · HH:mm')}
          </Text>
          <Text selectable>{n.body}</Text>
        </View>
      ))}
      <TextField
        label={t('console.support.notes.label')}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
        testID="console-support-note-input"
      />
      <FormError error={add.error} />
      <Button
        label={t('console.support.notes.add')}
        variant="secondary"
        size="sm"
        disabled={!body.trim()}
        loading={add.isPending}
        onPress={() =>
          add.mutate(
            { thread, body },
            {
              onSuccess: () => {
                setBody('');
                toast(t('console.support.notes.added'));
              },
            },
          )
        }
        testID="console-support-note-add"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, padding: spacing.md, borderWidth: 1 },
  note: { gap: spacing.xs },
});
