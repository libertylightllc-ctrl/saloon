import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useWorkspace } from '@/features/auth/session';
import { useStaffDirectory, type RoleTitle } from '@/features/staff/api';
import { useCreateStaffLogin } from '@/features/team/api';
import { parsePercent } from '@/lib/money';
import { spacing } from '@/theme';
import { BottomSheet, Button, Chip, FormError, FormTextField, Text, useToast } from '@/ui';

const ROLES = ['cashier', 'staff', 'accountant'] as const;

const schema = z.object({
  display_name: z.string().trim().min(1, 'validation.required').max(60, 'validation.tooLong'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,20}$/, 'validation.username'),
  password: z.string().min(8, 'validation.passwordLength'),
  role: z.enum(ROLES),
  commission: z.string().refine((v) => v.trim() === '' || parsePercent(v) !== null, 'validation.percent'),
});
type Values = z.infer<typeof schema>;

/** Someone already in Staff & payroll: the login goes on their record, with their pay, roster and WPS. */
export interface LoginFor {
  employee_id: string;
  full_name: string;
  role_title: RoleTitle;
}

/** A new login: for someone picked from the staff list (or given as `person`), or for someone new. */
export function CreateLoginSheet({ open, onClose, person }: { open: boolean; onClose: () => void; person?: LoginFor }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={person ? t('team.loginFor', { name: person.full_name }) : t('team.newLogin')} snapPoints={['90%']}>
      {open ? <CreateLoginForm onDone={onClose} person={person} /> : null}
    </BottomSheet>
  );
}

const roleFor = (title: RoleTitle) => (title === 'cashier' ? 'cashier' : 'staff');

/** Mounted each time the sheet opens, so the form starts empty. */
function CreateLoginForm({ onDone, person }: { onDone: () => void; person?: LoginFor }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const create = useCreateStaffLogin(business.id, branch.id);
  // People on the staff list without a login yet: pick one so they are not added twice.
  const staff = useStaffDirectory(business.id, !person);
  const withoutLogin = (staff.data ?? []).filter((s) => s.active && !s.member_id);
  const [pick, setPick] = useState<LoginFor | null>(person ?? null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: person?.full_name ?? '',
      username: '',
      password: '',
      role: person ? roleFor(person.role_title) : 'staff',
      commission: '',
    },
  });
  const role = useWatch({ control: form.control, name: 'role' });
  const choose = (p: LoginFor | null) => {
    setPick(p);
    form.setValue('display_name', p?.full_name ?? '');
    form.setValue('role', p ? roleFor(p.role_title) : 'staff');
  };

  const submit = form.handleSubmit((v) =>
    create.mutate(
      {
        display_name: v.display_name,
        username: v.username,
        password: v.password,
        role: v.role,
        commission_bps: v.role === 'staff' && !pick ? (parsePercent(v.commission) ?? 0) : 0,
        colour: null,
        ...(pick ? { employee_id: pick.employee_id } : {}),
      },
      {
        onSuccess: (data) => {
          toast(t('team.created', { username: data.username, code: business.code }));
          onDone();
        },
      },
    ),
  );

  return (
    <>
      {!person && withoutLogin.length > 0 ? (
        <View style={styles.section}>
          <Text variant="bodyStrong">{t('team.whoFor')}</Text>
          <View style={styles.wrap}>
            {withoutLogin.map((s) => (
              <Chip
                key={s.employee_id}
                icon="user"
                label={s.full_name}
                selected={pick?.employee_id === s.employee_id}
                onPress={() => choose({ employee_id: s.employee_id, full_name: s.full_name, role_title: s.role_title })}
                testID={`login-for-${s.full_name}`}
              />
            ))}
            <Chip icon="userPlus" label={t('team.someoneNew')} selected={!pick} onPress={() => choose(null)} testID="login-for-new" />
          </View>
          <Text variant="small" color="textSecondary">
            {t('team.pickHint')}
          </Text>
        </View>
      ) : null}
      {pick ? (
        <Text color="textSecondary">{t('team.fromStaff', { name: pick.full_name })}</Text>
      ) : (
        <FormTextField control={form.control} name="display_name" label={t('team.fields.name')} />
      )}
      <Controller
        control={form.control}
        name="role"
        render={({ field }) => (
          <View style={styles.section}>
            <Text variant="bodyStrong">{t('team.fields.role')}</Text>
            <View style={styles.wrap}>
              {ROLES.map((r) => (
                <Chip key={r} label={t(`roles.${r}`)} selected={field.value === r} onPress={() => field.onChange(r)} testID={`role-${r}`} />
              ))}
            </View>
            <Text variant="small" color="textSecondary">
              {t(`team.roleHint.${field.value}`)}
            </Text>
          </View>
        )}
      />
      <FormTextField
        control={form.control}
        name="username"
        label={t('team.fields.username')}
        hint={t('team.usernameHint', { code: business.code })}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FormTextField control={form.control} name="password" label={t('team.fields.password')} secureTextEntry autoCapitalize="none" />
      {role === 'staff' && !pick ? (
        <FormTextField control={form.control} name="commission" label={t('team.fields.commission')} keyboardType="decimal-pad" />
      ) : null}
      <FormError error={create.error} />
      <Button label={t('team.create')} onPress={submit} loading={create.isPending} testID="create-login" />
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
