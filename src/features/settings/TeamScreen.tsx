import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useManageStaffLogin, useTeam, type TeamMember } from '@/features/team/api';
import { formatBps } from '@/lib/money';
import { spacing } from '@/theme';
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  FormError,
  HeaderBand,
  ListRow,
  QueryState,
  Screen,
  StatusPill,
  Text,
  TextField,
  useToast,
} from '@/ui';

import { CreateLoginSheet } from './CreateLoginSheet';

export function TeamScreen() {
  const { t } = useTranslation();
  const { business, member: me } = useWorkspace();
  const team = useTeam(business.id);
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<TeamMember | null>(null);

  return (
    <>
      <Screen
        refreshing={team.isRefetching}
        onRefresh={() => void team.refetch()}
        header={
          <HeaderBand
            title={t('team.title')}
            onBack
            right={
              <Button label={t('common.new')} icon="plus" size="sm" variant="secondary" onPress={() => setCreating(true)} testID="team-new" />
            }
          />
        }
      >
        <View style={styles.body}>
          <Card variant="tinted" style={styles.code}>
            <Text variant="small" color="textOnTint">
              {t('team.codeExplain')}
            </Text>
            <Text variant="h3" color="primaryText" testID="team-salon-code">
              {business.code}
            </Text>
          </Card>
          <QueryState query={team}>
            {(members) => (
              <View style={styles.list}>
                {members.map((m) => (
                  <ListRow
                    key={m.id}
                    testID={`member-${m.username ?? 'owner'}`}
                    leading={<Avatar name={m.display_name} size={44} />}
                    title={m.display_name}
                    meta={[
                      [t(`roles.${m.role}`), m.username ? `@${m.username}` : null].filter(Boolean).join(' · '),
                      ...(m.role === 'staff' && m.employees?.commission_bps
                        ? [t('team.commission', { rate: formatBps(m.employees.commission_bps) })]
                        : []),
                    ]}
                    trailing={m.active ? undefined : <StatusPill tone="neutral" label={t('team.disabled')} />}
                    chevron={m.id !== me.id && m.role !== 'owner'}
                    onPress={m.id !== me.id && m.role !== 'owner' ? () => setManaging(m) : undefined}
                  />
                ))}
              </View>
            )}
          </QueryState>
        </View>
      </Screen>
      <CreateLoginSheet open={creating} onClose={() => setCreating(false)} />
      <ManageSheet member={managing} onClose={() => setManaging(null)} />
    </>
  );
}

function ManageSheet({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
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

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  code: { gap: spacing.xs },
  list: { gap: spacing.sm },
});
