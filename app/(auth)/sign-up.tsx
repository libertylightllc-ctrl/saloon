import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { signUpOwner } from '@/features/auth/api';
import { AuthShell } from '@/features/auth/AuthShell';
import { spacing } from '@/theme';
import { Button, FormError, FormTextField } from '@/ui';

const schema = z
  .object({
    name: z.string().trim().min(2, 'validation.name'),
    email: z.string().trim().min(1, 'validation.required').email('validation.email'),
    password: z.string().min(8, 'validation.passwordMin'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'validation.passwordMatch', path: ['confirm'] });

type Values = z.infer<typeof schema>;

/** Owner account. Setting up the salon comes next (the session gate opens /setup). */
export default function SignUp() {
  const { t } = useTranslation();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  });
  const signUp = useMutation({ mutationFn: (v: Values) => signUpOwner(v.name, v.email, v.password) });
  const submit = form.handleSubmit((values) => signUp.mutate(values));

  return (
    <AuthShell title={t('auth.signUp.title')} subtitle={t('auth.signUp.subtitle')} onBack>
      <View style={styles.form}>
        <FormTextField control={form.control} name="name" label={t('auth.fields.yourName')} autoComplete="name" />
        <FormTextField
          control={form.control}
          name="email"
          label={t('auth.fields.email')}
          placeholder={t('auth.fields.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <FormTextField
          control={form.control}
          name="password"
          label={t('auth.fields.password')}
          hint={t('auth.fields.passwordHint')}
          secureTextEntry
          autoComplete="new-password"
        />
        <FormTextField
          control={form.control}
          name="confirm"
          label={t('auth.fields.confirmPassword')}
          secureTextEntry
          autoComplete="new-password"
          onSubmitEditing={submit}
        />
        <FormError error={signUp.error} />
        <Button label={t('auth.signUp.action')} onPress={submit} loading={signUp.isPending} testID="sign-up-submit" />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing.lg } });
