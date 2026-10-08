import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { PlanPeopleNote } from '@/features/plan/PlanPeopleNote';
import { spacing } from '@/theme';
import { Chip, Text, TextField } from '@/ui';

import type { RoleTitle } from './api';

/** What a login may do in the app (its role); the owner's own login is not made here. */
export type AppAccess = 'cashier' | 'staff' | 'accountant';
export const APP_ACCESS: AppAccess[] = ['cashier', 'staff', 'accountant'];

export interface LoginDraft {
  access: AppAccess;
  username: string;
  password: string;
}

const USERNAME = /^[a-z0-9._-]{3,20}$/;
export const cleanUsername = (u: string) => u.trim().toLowerCase();
export const usernameOk = (u: string) => USERNAME.test(cleanUsername(u));
export const loginValid = (d: LoginDraft) => usernameOk(d.username) && d.password.length >= 8;
/** A cashier's login works the till; everyone else on the floor gets a staff login. */
export const accessFor = (title: RoleTitle): AppAccess => (title === 'cashier' ? 'cashier' : 'staff');

/** Username, password and what they can do: the same fields wherever a login is made. */
export function LoginFields({
  value,
  onChange,
  choices = APP_ACCESS,
}: {
  value: LoginDraft;
  onChange: (next: LoginDraft) => void;
  choices?: AppAccess[];
}) {
  const { t } = useTranslation();
  const { business } = useWorkspace();
  const set = (patch: Partial<LoginDraft>) => onChange({ ...value, ...patch });
  return (
    <View style={styles.box}>
      {choices.length > 1 ? (
        <View style={styles.section}>
          <Text variant="bodyStrong">{t('staff.appAccess')}</Text>
          <View style={styles.wrap}>
            {choices.map((r) => (
              <Chip key={r} label={t(`roles.${r}`)} selected={value.access === r} onPress={() => set({ access: r })} testID={`role-${r}`} />
            ))}
          </View>
          <Text variant="small" color="textSecondary">
            {t(`team.roleHint.${value.access}`)}
          </Text>
        </View>
      ) : null}
      <TextField
        label={t('team.fields.username')}
        hint={t('team.usernameHint', { code: business.code })}
        value={value.username}
        onChangeText={(username) => set({ username })}
        autoCapitalize="none"
        autoCorrect={false}
        error={value.username.trim() && !usernameOk(value.username) ? t('validation.username') : undefined}
        testID="login-username"
      />
      <TextField
        label={t('team.fields.password')}
        hint={t('validation.passwordLength')}
        value={value.password}
        onChangeText={(password) => set({ password })}
        secureTextEntry
        autoCapitalize="none"
        testID="login-password"
      />
      <PlanPeopleNote />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
