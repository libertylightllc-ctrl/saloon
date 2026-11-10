import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useManageStaffLogin, type TeamMember } from '@/features/team/api';
import { spacing } from '@/theme';
import { BottomSheet, Button, Chip, FormError, Text, TextField, useToast } from '@/ui';

import { useSetLoginType } from './api';
import type { AppAccess } from './LoginFields';

const TYPES: AppAccess[] = ['manager', 'cashier', 'staff', 'accountant'];

/**
 * A login's password and whether it may sign in (owner; a manager for front-desk and stylist logins in their branch),
 * and its login type (owner only): the person's staff record, sales, pay and history stay.
 */
export function ManageLoginSheet({
  member,
  canChangeType = false,
  onClose,
}: {
  member: TeamMember | null;
  canChangeType?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const manage = useManageStaffLogin(business.id);
  const setType = useSetLoginType(business.id, branch.id);
  const [password, setPassword] = useState('');
  const [type, setTypeChoice] = useState<AppAccess | null>(null);
  const close = () => {
    setPassword('');
    setTypeChoice(null);
    manage.reset();
    setType.reset();
    onClose();
  };
  const current = member?.role === 'owner' ? null : (member?.role ?? null);
  const chosen = type ?? current;

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
          {canChangeType && current ? (
            <View style={styles.types}>
              <Text variant="bodyStrong">{t('staff.appAccess')}</Text>
              <View style={styles.wrap}>
                {TYPES.map((r) => (
                  <Chip key={r} label={t(`roles.${r}`)} selected={chosen === r} onPress={() => setTypeChoice(r)} testID={`login-type-${r}`} />
                ))}
              </View>
              {chosen ? (
                <Text variant="small" color="textSecondary">
                  {t(`team.roleHint.${chosen}`)}
                </Text>
              ) : null}
              <FormError error={setType.error} />
              {chosen && chosen !== current ? (
                <Button
                  label={t('staff.changeLoginType', { type: t(`roles.${chosen}`) })}
                  variant="secondary"
                  loading={setType.isPending}
                  onPress={() =>
                    setType.mutate(
                      { member_id: member.id, role: chosen },
                      {
                        onSuccess: () => {
                          toast(t('staff.loginTypeChanged', { name: member.display_name, type: t(`roles.${chosen}`) }));
                          close();
                        },
                      },
                    )
                  }
                  testID="login-type-save"
                />
              ) : null}
            </View>
          ) : null}
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

const styles = StyleSheet.create({
  types: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
