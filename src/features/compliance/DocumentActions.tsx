import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { spacing } from '@/theme';
import { BottomSheet, Button, FormError, Text, TextField, useToast } from '@/ui';

import { useRemoveDocument, type Slot } from './api';
import { DocumentForm } from './DocumentForm';
import { useDocName } from './labels';

export type DocumentStage = 'menu' | 'edit' | 'renew' | 'add' | 'delete';

/**
 * What can be done with one register item (owner, 2026-10-05: every item can be edited and deleted): edit its details,
 * renew it or add its details, and delete it. From the register's "⋯" it opens at the menu; from the record's page at
 * the chosen action.
 */
export function DocumentActions({
  slot,
  start = 'menu',
  onClose,
  onDeleted,
  onSaved,
}: {
  /** The item; null keeps the sheet closed. */
  slot: Slot | null;
  start?: DocumentStage;
  onClose: () => void;
  onDeleted?: () => void;
  /** After a save, with the record's name (the owner's own records can be renamed). */
  onSaved?: (docType: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const docName = useDocName();
  const { business, branch } = useWorkspace();
  const remove = useRemoveDocument(business.id, branch.id);
  const [stage, setStage] = useState<DocumentStage>(start);
  const [reason, setReason] = useState('');
  // Back to the starting step each time the sheet opens (not when a live refresh hands over a fresh copy of the item).
  const key = slot ? `${slot.slot_key}:${start}` : null;
  const [openedFor, setOpenedFor] = useState(key);
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) setStage(start);
  }

  const close = () => {
    setReason('');
    remove.reset();
    onClose();
  };
  const name = slot ? docName(slot.doc_type) : '';

  return (
    <BottomSheet open={slot !== null} onClose={close} title={stage === 'delete' ? t('compliance.deleteTitle', { name }) : name}>
      {!slot ? null : stage === 'menu' ? (
        <View style={styles.stack}>
          <Text color="textSecondary">{slot.holder_name}</Text>
          {slot.document_id ? (
            <>
              <Button label={t('compliance.editDetails')} icon="pencil" variant="secondary" onPress={() => setStage('edit')} testID="doc-action-edit" />
              <Button label={t('compliance.renew')} icon="rotate" variant="outline" onPress={() => setStage('renew')} testID="doc-action-renew" />
            </>
          ) : (
            <Button label={t('compliance.addDetails')} icon="plus" variant="secondary" onPress={() => setStage('add')} testID="doc-action-add" />
          )}
          <Button label={t('compliance.delete')} icon="trash" variant="ghost" onPress={() => setStage('delete')} testID="doc-action-delete" />
        </View>
      ) : stage === 'delete' ? (
        <View style={styles.stack}>
          <Text color="textSecondary">{t('compliance.deleteBody')}</Text>
          <TextField
            label={t('compliance.deleteReason')}
            placeholder={t('compliance.deleteReasonHint')}
            value={reason}
            onChangeText={setReason}
            maxLength={200}
            testID="doc-delete-reason"
          />
          <FormError error={remove.error} />
          <Button
            label={t('compliance.delete')}
            icon="trash"
            variant="danger"
            loading={remove.isPending}
            onPress={() =>
              remove.mutate(
                { slot, reason },
                {
                  onSuccess: () => {
                    toast(t('compliance.deleted'));
                    close();
                    onDeleted?.();
                  },
                },
              )
            }
            testID="doc-delete-confirm"
          />
        </View>
      ) : (
        <DocumentForm
          slot={slot}
          edit={stage === 'edit'}
          onDone={(_id, docType) => {
            close();
            onSaved?.(docType);
          }}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
});
