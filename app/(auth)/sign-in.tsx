import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { rememberedSalonCode, rememberedSignInAs, signInOwner, signInStaff } from '@/features/auth/api';
import { AuthShell } from '@/features/auth/AuthShell';
import { useSession } from '@/features/auth/session';
import { AppError } from '@/lib/errors';
import { spacing } from '@/theme';
import { Button, FormError, FormTextField, SegmentTabs, Text } from '@/ui';

const ownerSchema = z.object({
  email: z.string().trim().min(1, 'validation.required').email('validation.email'),
  password: z.string().min(1, 'validation.required'),
});
const staffSchema = z.object({
  salonCode: z.string().trim().min(4, 'validation.salonCode').regex(/^[a-zA-Z0-9]+$/, 'validation.salonCode'),
  username: z.string().trim().min(3, 'validation.username'),
  password: z.string().min(1, 'validation.required'),
});

type Who = 'owner' | 'staff';

export default function SignIn() {
  const { t } = useTranslation();
  const { notice, clearNotice } = useSession();
  const [who, setWho] = useState<Who>('owner');
  useEffect(() => {
    let live = true;
    rememberedSignInAs().then((last) => {
      if (live) setWho(last);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <AuthShell title={t('auth.signIn.title')} subtitle={t('auth.signIn.subtitle')}>
      <SegmentTabs<Who>
        items={[
          { key: 'owner', label: t('auth.signIn.owner') },
          { key: 'staff', label: t('auth.signIn.staff') },
        ]}
        value={who}
        onChange={(next) => {
          clearNotice();
          setWho(next);
        }}
        testID="sign-in-as"
      />
      {notice ? <FormError error={new AppError(notice)} testID="session-notice" /> : null}
      {who === 'owner' ? <OwnerForm /> : <StaffForm />}
    </AuthShell>
  );
}

function OwnerForm() {
  const { t } = useTranslation();
  const { clearNotice } = useSession();
  const form = useForm<z.infer<typeof ownerSchema>>({
    resolver: zodResolver(ownerSchema),
    defaultValues: { email: '', password: '' },
  });
  const signIn = useMutation({ mutationFn: (v: z.infer<typeof ownerSchema>) => signInOwner(v.email, v.password) });
  const submit = form.handleSubmit((values) => {
    clearNotice();
    signIn.mutate(values);
  });

  return (
    <View style={styles.form}>
      <FormTextField
        control={form.control}
        name="email"
        label={t('auth.fields.email')}
        placeholder={t('auth.fields.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <FormTextField
        control={form.control}
        name="password"
        label={t('auth.fields.password')}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      <FormError error={signIn.error} />
      <Button label={t('auth.signIn.action')} onPress={submit} loading={signIn.isPending} testID="sign-in-submit" />
      <View style={styles.links}>
        <Link href="/forgot-password" asChild>
          <Button label={t('auth.signIn.forgot')} variant="ghost" size="md" testID="link-forgot" />
        </Link>
        <Link href="/sign-up" asChild>
          <Button label={t('auth.signIn.createAccount')} variant="secondary" size="md" testID="link-sign-up" />
        </Link>
      </View>
    </View>
  );
}

function StaffForm() {
  const { t } = useTranslation();
  const { clearNotice } = useSession();
  const form = useForm<z.infer<typeof staffSchema>>({
    resolver: zodResolver(staffSchema),
    defaultValues: { salonCode: '', username: '', password: '' },
  });
  useEffect(() => {
    rememberedSalonCode().then((code) => {
      if (code && !form.getValues('salonCode')) form.setValue('salonCode', code);
    });
  }, [form]);
  const signIn = useMutation({
    mutationFn: (v: z.infer<typeof staffSchema>) => signInStaff(v.salonCode, v.username, v.password),
  });
  const submit = form.handleSubmit((values) => {
    clearNotice();
    signIn.mutate(values);
  });

  return (
    <View style={styles.form}>
      <FormTextField
        control={form.control}
        name="salonCode"
        label={t('auth.fields.salonCode')}
        hint={t('auth.fields.salonCodeHint')}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FormTextField
        control={form.control}
        name="username"
        label={t('auth.fields.username')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
      />
      <FormTextField
        control={form.control}
        name="password"
        label={t('auth.fields.password')}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={submit}
      />
      <FormError error={signIn.error} />
      <Button label={t('auth.signIn.action')} onPress={submit} loading={signIn.isPending} testID="sign-in-submit" />
      <Text variant="small" color="textSecondary" align="center">
        {t('auth.signIn.staffHelp')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
});
