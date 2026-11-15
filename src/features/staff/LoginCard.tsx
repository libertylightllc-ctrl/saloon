import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useTeam } from '@/features/team/api';
import { can, levelOf } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, Card, FormError, StatusPill, Text, useToast } from '@/ui';

import { useLastSignIn, useSetLoginType, type StaffMember } from './api';
import { CreateLoginSheet } from './CreateLoginSheet';
import { ManageLoginSheet } from './ManageLoginSheet';

/**
 * A person's app login on their page: who they sign in as; the owner creates, resets, switches off or changes its type;
 * a manager resets or switches off front-desk and stylist logins in a branch they share (the server checks the branch).
 * A Manager job on another login type asks the owner to change it (B7: nobody becomes Manager by themselves).
 */
export function LoginCard({ person }: { person: StaffMember }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch, role } = useWorkspace();
  const owner = can(role, 'manageUsers');
  const branchAdmin = levelOf(role, 'resetLogin') === 'branch';
  const team = useTeam(business.id, (owner || branchAdmin) && Boolean(person.member_id));
  const member = team.data?.find((m) => m.id === person.member_id) ?? null;
  const manages = member !== null && (owner || (branchAdmin && (member.role === 'cashier' || member.role === 'staff')));
  // Who uses their login (F4): for the people who look after it.
  const lastSignIn = useLastSignIn(member?.id ?? null, manages);
  const dates = useDates();
  const setType = useSetLoginType(business.id, branch.id);
  const mismatch = owner && member !== null && person.role_title === 'manager' && member.role !== 'manager' && member.role !== 'owner';
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);

  return (
    <>
      <Card variant="outlined" style={styles.card} testID="staff-login-card">
        <View style={styles.row}>
          <Text variant="h4" style={styles.flex}>
            {t('staff.loginTitle')}
          </Text>
          {member && !member.active ? <StatusPill tone="neutral" label={t('team.disabled')} /> : null}
        </View>
        {person.username ? (
          <Text color="textSecondary">
            {[`@${person.username}`, member ? t(`roles.${member.role}`) : null, t('staff.salonCode', { code: business.code })]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : (
          <Text color="textSecondary">{t('staff.noLoginBody')}</Text>
        )}
        {manages && lastSignIn.isSuccess ? (
          <Text color="textSecondary" testID="staff-last-sign-in">
            {lastSignIn.data ? t('staff.lastSignIn', { when: dates.when(lastSignIn.data, business.timezone) }) : t('staff.neverSignedIn')}
          </Text>
        ) : null}
        {mismatch ? (
          <View style={styles.mismatch} testID="staff-job-mismatch">
            <Text>{t('staff.jobMismatch', { login: t(`roles.${member.role}`) })}</Text>
            <FormError error={setType.error} />
            <View style={styles.row}>
              <Button
                label={t('staff.makeManager')}
                variant="secondary"
                size="md"
                loading={setType.isPending}
                onPress={() =>
                  setType.mutate(
                    { member_id: member.id, role: 'manager' },
                    { onSuccess: () => toast(t('staff.loginTypeChanged', { name: person.full_name, type: t('roles.manager') })) },
                  )
                }
                testID="staff-make-manager"
              />
            </View>
          </View>
        ) : null}
        {manages ? (
          <Button label={t('staff.manageLogin')} icon="keyRound" variant="outline" size="md" onPress={() => setManaging(true)} testID="staff-manage-login" />
        ) : null}
        {owner && !person.username ? (
          <Button label={t('staff.createLogin')} icon="keyRound" variant="secondary" size="md" onPress={() => setCreating(true)} testID="staff-create-login" />
        ) : null}
      </Card>
      {!person.username ? (
        <CreateLoginSheet
          open={creating}
          onClose={() => setCreating(false)}
          person={{ employee_id: person.employee_id, full_name: person.full_name, role_title: person.role_title }}
        />
      ) : null}
      <ManageLoginSheet member={managing ? member : null} canChangeType={owner} onClose={() => setManaging(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  mismatch: { gap: spacing.sm },
});
