import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { BottomSheet, Button, FormError, Text, TextField } from '@/ui';

import { useDeleteAccount } from './api';

/**
 * Deleting one's own account, as the app stores require. The owner is told it closes the salon; everyone is told the
 * salon's records are kept (UAE law). The person types a word to confirm; they end on the sign-in page, told the
 * account was deleted.
 */
export function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { business, role } = useWorkspace();
  const remove = useDeleteAccount();
  const [typed, setTyped] = useState('');
  const word = t('account.delete.word');
  const owner = role === 'owner';
  const confirmed = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();

  const close = () => {
    setTyped('');
    remove.reset();
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={close} title={t('account.delete.title')}>
      <View style={styles.body} testID="delete-account-sheet">
        <Text>{t(owner ? 'account.delete.ownerBody' : 'account.delete.staffBody', { salon: business.name })}</Text>
        <Text color="textSecondary">{t('account.delete.kept')}</Text>
        {can(role, 'backup') ? (
          <Button
            variant="outline"
            label={t('account.delete.backupFirst')}
            onPress={() => {
              close();
              router.push('/settings/backup');
            }}
            testID="delete-account-backup"
          />
        ) : null}
        <TextField
          label={t('account.delete.typeLabel', { word })}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          testID="delete-account-confirm"
        />
        <FormError error={remove.error} />
        <Button
          variant="danger"
          label={t('account.delete.action')}
          disabled={!confirmed}
          loading={remove.isPending}
          onPress={() => remove.mutate()}
          testID="delete-account-submit"
        />
        <Button variant="ghost" label={t('common.cancel')} onPress={close} testID="delete-account-cancel" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: spacing.md } });
