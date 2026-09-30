import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { useManageStaffLogin, type TeamMember } from '@/features/team/api';
import { BottomSheet, Button, FormError, Text, TextField, useToast } from '@/ui';

/** A login's password and whether it may sign in (owner). */
export function ManageLoginSheet({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business } = useWorkspace();
  const manage = useManageStaffLogin(business.id);
  const [password, setPassword] = useState('');
  const close = () => {
    setPassword('');
    manage.reset();
    onClose();
  };

  return (
    <BottomSheet open={member !== null} onClose={close} title={member?.display_name}>
      {member ? (
        <>
          <Text color="textSecondary">{`${t(`roles.${member.role}`)} · @${member.username ?? ''}`}</Text>
          <TextField
            label={t('team.newPassword')}
            hint={t('validation.passwordLength')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            testID="reset-password"
          />
          <Button
            label={t('team.resetPassword')}
            variant="secondary"
            disabled={password.length < 8}
            loading={manage.isPending && manage.variables?.action === 'reset_password'}
            onPress={() =>
              manage.mutate(
                { member_id: member.id, action: 'reset_password', password },
                { onSuccess: () => { toast(t('team.passwordReset')); close(); } },
              )
            }
            testID="reset-password-save"
          />
          <FormError error={manage.error} />
          <Button
            label={t(member.active ? 'team.disable' : 'team.enable')}
            variant="ghost"
            loading={manage.isPending && manage.variables?.action === 'set_active'}
            onPress={() =>
              manage.mutate(
                { member_id: member.id, action: 'set_active', active: !member.active },
                {
                  onSuccess: () => {
                    toast(t(member.active ? 'team.disabledToast' : 'team.enabledToast', { name: member.display_name }));
                    close();
                  },
                },
              )
            }
            testID="toggle-active"
          />
        </>
      ) : null}
    </BottomSheet>
  );
}
