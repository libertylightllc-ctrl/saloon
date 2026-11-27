import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useRemoveSavedReply, useSavedReplies, useSaveReply, type SavedReply } from '@/features/support/adminApi';
import { spacing } from '@/theme';
import { Button, Chip, FormError, ListRow, Text, TextField, useToast } from '@/ui';

/**
 * Saved replies (owner's brief, Part E3): tap one to put it in the message box, filled in with who wrote and their
 * salon. Manage adds, changes and removes them; each of those is written to Changes.
 */
export function SupportSavedReplies({ onPick }: { onPick: (body: string) => void }) {
  const { t } = useTranslation();
  const replies = useSavedReplies();
  const [managing, setManaging] = useState(false);
  const list = replies.data ?? [];
  return (
    <View style={styles.box} testID="console-saved-replies">
      <View style={styles.head}>
        <Text variant="bodyStrong" style={styles.grow}>
          {t('console.support.saved.title')}
        </Text>
        <Button
          label={t(managing ? 'console.support.saved.done' : 'console.support.saved.manage')}
          variant="ghost"
          size="sm"
          onPress={() => setManaging((m) => !m)}
          testID="console-saved-manage"
        />
      </View>
      {managing ? (
        <Manage list={list} />
      ) : list.length === 0 ? (
        <Text variant="small" color="textSecondary">
          {t('console.support.saved.none')}
        </Text>
      ) : (
        <View style={styles.chips}>
          {list.map((r) => (
            <Chip key={r.id} label={r.title} onPress={() => onPick(r.body)} testID={`console-saved-${r.title}`} />
          ))}
        </View>
      )}
    </View>
  );
}

function Manage({ list }: { list: SavedReply[] }) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSaveReply();
  const remove = useRemoveSavedReply();
  const [editing, setEditing] = useState<SavedReply | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const start = (r: SavedReply | null) => {
    setEditing(r);
    setTitle(r?.title ?? '');
    setBody(r?.body ?? '');
  };
  return (
    <View style={styles.box}>
      {list.map((r) => (
        <ListRow
          key={r.id}
          title={r.title}
          meta={[r.body]}
          onPress={() => start(r)}
          chevron
          testID={`console-saved-row-${r.title}`}
        />
      ))}
      <Text variant="small" color="textSecondary">
        {t('console.support.saved.hint')}
      </Text>
      <TextField
        label={t('console.support.saved.name')}
        value={title}
        onChangeText={setTitle}
        maxLength={60}
        testID="console-saved-title"
      />
      <TextField
        label={t('console.support.saved.text')}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
        testID="console-saved-body"
      />
      <FormError error={save.error ?? remove.error} />
      <View style={styles.row}>
        <Button
          label={t(editing ? 'console.support.saved.save' : 'console.support.saved.add')}
          size="sm"
          disabled={title.trim().length < 2 || body.trim().length < 2}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              { id: editing?.id, title, body },
              {
                onSuccess: () => {
                  toast(t('console.support.saved.savedToast'));
                  start(null);
                },
              },
            )
          }
          testID="console-saved-save"
        />
        {editing ? (
          <>
            <Button
              label={t('console.support.saved.remove')}
              variant="ghost"
              size="sm"
              loading={remove.isPending}
              onPress={() =>
                remove.mutate(editing.id, {
                  onSuccess: () => {
                    toast(t('console.support.saved.removedToast'));
                    start(null);
                  },
                })
              }
              testID="console-saved-remove"
            />
            <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={() => start(null)} />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
