import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { PlanPeopleNote } from '@/features/plan/PlanPeopleNote';
import { spacing } from '@/theme';
import { Button, Chip, Text, TextField } from '@/ui';

import type { RoleTitle } from './api';

/** What a login may do in the app (its login type, B1); the owner's own login is not made here. */
export type AppAccess = 'manager' | 'cashier' | 'staff' | 'accountant';
/** The floor's login types; an accountant is made by picking the Accountant job (one way, B7). */
export const FLOOR_ACCESS: AppAccess[] = ['manager', 'cashier', 'staff'];

export interface LoginDraft {
  access: AppAccess;
  username: string;
  password: string;
}

const USERNAME = /^[a-z0-9._-]{3,20}$/;
export const cleanUsername = (u: string) => u.trim().toLowerCase();
export const usernameOk = (u: string) => USERNAME.test(cleanUsername(u));
export const loginValid = (d: LoginDraft) => usernameOk(d.username) && d.password.length >= 8;
/**
 * The login type a job starts with (B7): Manager → Manager; Receptionist, Cashier → Front desk; Accountant →
 * Accountant; Assistant → no login; the jobs that serve clients → Stylist / therapist. Still changeable.
 */
export function accessFor(title: RoleTitle): AppAccess | null {
  switch (title) {
    case 'manager':
      return 'manager';
    case 'receptionist':
    case 'cashier':
      return 'cashier';
    case 'accountant':
      return 'accountant';
    case 'assistant':
      return null;
    default:
      return 'staff';
  }
}

/** Username, password and what they can do: the same fields wherever a login is made. */
export function LoginFields({
  value,
  onChange,
  choices = FLOOR_ACCESS,
  seeAll = true,
}: {
  value: LoginDraft;
  onChange: (next: LoginDraft) => void;
  choices?: AppAccess[];
  /** The "See everything this login can do" link; off inside a sheet (the page would open behind it). */
  seeAll?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { business } = useWorkspace();
  const set = (patch: Partial<LoginDraft>) => onChange({ ...value, ...patch });
  return (
    <View style={styles.box}>
      <View style={styles.section}>
        <Text variant="bodyStrong">{t('staff.appAccess')}</Text>
        {choices.length > 1 ? (
          <View style={styles.wrap}>
            {choices.map((r) => (
              <Chip key={r} label={t(`roles.${r}`)} selected={value.access === r} onPress={() => set({ access: r })} testID={`role-${r}`} />
            ))}
          </View>
        ) : (
          <Text>{t(`roles.${value.access}`)}</Text>
        )}
        <Text variant="small" color="textSecondary" testID="role-description">
          {t(`team.roleHint.${value.access}`)}
        </Text>
        {seeAll ? (
          <View style={styles.row}>
            <Button
              label={t('logins.seeAll')}
              variant="ghost"
              size="sm"
              icon="clipboard"
              onPress={() => router.push({ pathname: '/staff/logins', params: { role: value.access } })}
              testID="role-see-all"
            />
          </View>
        ) : null}
      </View>
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
  row: { flexDirection: 'row' },
});
