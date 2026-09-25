import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { resetPasswordWithCode, sendResetCode } from '@/features/auth/api';
import { AuthShell } from '@/features/auth/AuthShell';
import { spacing } from '@/theme';
import { Button, FormError, FormTextField, Text, useToast } from '@/ui';

const emailSchema = z.object({ email: z.string().trim().min(1, 'validation.required').email('validation.email') });
const resetSchema = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/, 'validation.code'),
    password: z.string().min(8, 'validation.passwordMin'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'validation.passwordMatch', path: ['confirm'] });

/** Owner password reset with a 6-digit code by email (works the same on phones and the web). */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const toast = useToast();
  const [email, setEmail] = useState<string | null>(null);

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });
  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: '', password: '', confirm: '' },
  });

  const send = useMutation({
    mutationFn: (v: z.infer<typeof emailSchema>) => sendResetCode(v.email),
    onSuccess: (_, v) => {
      setEmail(v.email.trim().toLowerCase());
      toast(t('auth.forgot.codeSent'));
    },
  });
  const reset = useMutation({
    mutationFn: (v: z.infer<typeof resetSchema>) => resetPasswordWithCode(email ?? '', v.code, v.password),
    onSuccess: () => toast(t('auth.forgot.done')),
  });

  return (
    <AuthShell title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')} onBack>
      {email === null ? (
        <View style={styles.form}>
          <FormTextField
            control={emailForm.control}
            name="email"
            label={t('auth.fields.email')}
            placeholder={t('auth.fields.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <FormError error={send.error} />
          <Button
            label={t('auth.forgot.send')}
            onPress={emailForm.handleSubmit((v) => send.mutate(v))}
            loading={send.isPending}
            testID="forgot-send"
          />
        </View>
      ) : (
        <View style={styles.form}>
          <Text color="textOnTint">{t('auth.forgot.enterCode', { email })}</Text>
          <FormTextField
            control={resetForm.control}
            name="code"
            label={t('auth.fields.code')}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          <FormTextField
            control={resetForm.control}
            name="password"
            label={t('auth.fields.newPassword')}
            hint={t('auth.fields.passwordHint')}
            secureTextEntry
            autoComplete="new-password"
          />
          <FormTextField
            control={resetForm.control}
            name="confirm"
            label={t('auth.fields.confirmPassword')}
            secureTextEntry
            autoComplete="new-password"
          />
          <FormError error={reset.error} />
          <Button
            label={t('auth.forgot.reset')}
            onPress={resetForm.handleSubmit((v) => reset.mutate(v))}
            loading={reset.isPending}
            testID="forgot-reset"
          />
          <Button
            label={t('auth.forgot.resend')}
            variant="ghost"
            size="md"
            onPress={() => send.mutate({ email })}
            loading={send.isPending}
          />
        </View>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing.lg } });
