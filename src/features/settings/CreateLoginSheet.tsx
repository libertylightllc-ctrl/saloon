import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useWorkspace } from '@/features/auth/session';
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

export function CreateLoginSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t('team.newLogin')} snapPoints={['90%']}>
      {open ? <CreateLoginForm onDone={onClose} /> : null}
    </BottomSheet>
  );
}

/** Mounted each time the sheet opens, so the form starts empty. */
function CreateLoginForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const create = useCreateStaffLogin(business.id, branch.id);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: '', username: '', password: '', role: 'staff', commission: '' },
  });
  const role = useWatch({ control: form.control, name: 'role' });

  const submit = form.handleSubmit((v) =>
    create.mutate(
      {
        display_name: v.display_name,
        username: v.username,
        password: v.password,
        role: v.role,
        commission_bps: v.role === 'staff' ? (parsePercent(v.commission) ?? 0) : 0,
        colour: null,
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
      <FormTextField control={form.control} name="display_name" label={t('team.fields.name')} />
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
      {role === 'staff' ? (
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
