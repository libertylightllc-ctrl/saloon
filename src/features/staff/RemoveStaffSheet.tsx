import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { BottomSheet, Button, FormError, Text, useToast } from '@/ui';

import { useRemoveStaff, type StaffMember } from './api';

/**
 * Removing someone from the staff (owner). Someone with nothing on record goes completely, login included; anyone
 * with sales, attendance or pay on record is archived instead, because those records must be kept.
 */
export function RemoveStaffSheet({ person, open, onClose }: { person: StaffMember; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { business, branch } = useWorkspace();
  const remove = useRemoveStaff(business.id, branch.id);
  const close = () => {
    remove.reset();
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={close} title={t('staff.remove.title', { name: person.full_name })}>
      <Text>{t('staff.remove.body')}</Text>
      <Text color="textSecondary">{t('staff.remove.archiveNote')}</Text>
      <FormError error={remove.error} />
      <Button
        label={t('staff.remove.action')}
        variant="danger"
        loading={remove.isPending}
        onPress={() =>
          remove.mutate(
            { employee_id: person.employee_id, action: 'remove' },
            {
              onSuccess: (r) => {
                toast(t(r.mode === 'removed' ? 'staff.remove.removed' : 'staff.remove.archived', { name: person.full_name }));
                if (r.mode === 'removed') router.replace('/staff');
                close();
              },
            },
          )
        }
        testID="staff-remove-confirm"
      />
      <Button label={t('common.cancel')} variant="ghost" onPress={close} testID="staff-remove-cancel" />
    </BottomSheet>
  );
}
