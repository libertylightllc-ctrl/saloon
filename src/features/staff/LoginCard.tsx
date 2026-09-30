import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useTeam } from '@/features/team/api';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { Button, Card, StatusPill, Text } from '@/ui';

import type { StaffMember } from './api';
import { CreateLoginSheet } from './CreateLoginSheet';
import { ManageLoginSheet } from './ManageLoginSheet';

/** A person's app login on their page: who they sign in as, and (owner) create, reset or switch it off. */
export function LoginCard({ person }: { person: StaffMember }) {
  const { t } = useTranslation();
  const { business, role } = useWorkspace();
  const owner = can(role, 'manageUsers');
  const team = useTeam(business.id, owner && Boolean(person.member_id));
  const member = team.data?.find((m) => m.id === person.member_id) ?? null;
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
        {owner && member ? (
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
      <ManageLoginSheet member={managing ? member : null} onClose={() => setManaging(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
