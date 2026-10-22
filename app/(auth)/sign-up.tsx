import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { signUpOwner } from '@/features/auth/api';
import { AuthShell } from '@/features/auth/AuthShell';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { composePhone, PhoneField, phoneNumberValid } from '@/features/auth/PhoneField';
import { SignUpDone } from '@/features/auth/SignUpDone';
import { usePublicPrices } from '@/features/plan/api';
import { usePageMeta } from '@/lib/pageMeta';
import { spacing } from '@/theme';
import { Button, CheckRow, FormError, FormTextField, Text } from '@/ui';

const schema = z.object({
  name: z.string().trim().min(2, 'validation.name'),
  email: z.string().trim().min(1, 'validation.required').email('validation.email'),
  // One password field with its show/hide eye (no "confirm"; website brief 3.2).
  password: z.string().min(8, 'validation.passwordMin'),
  phone: z.object({ dial: z.string(), number: z.string() }).refine((v) => phoneNumberValid(v.number), 'validation.mobile'),
  whatsappOk: z.boolean(),
});

type Values = z.infer<typeof schema>;

/** Owner account. Setting up the salon comes next (the session gate opens /setup), with the salon type. */
export default function SignUp() {
  const { t } = useTranslation();
  const router = useRouter();
  const trialDays = usePublicPrices().data?.trial_days ?? 7;
  usePageMeta(t('meta.signUp.title', { count: trialDays }), t('meta.signUp.description'));
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', phone: { dial: '971', number: '' }, whatsappOk: false },
  });
  const signUp = useMutation({
    mutationFn: (v: Values) => {
      const phone = composePhone(v.phone);
      return signUpOwner(v.name, v.email, v.password, phone ? { phone, whatsappOk: v.whatsappOk } : undefined);
    },
  });
  const submit = form.handleSubmit((values) => signUp.mutate(values));
  // The offer, under the title and again above the button (brief 3.1).
  const offer = t('auth.signUp.offer', { count: trialDays });

  // Back: where the visitor came from, else the home page (not sign-in; brief 1.4).
  const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));

  // No session yet (email confirmation on): "check your inbox", or this address already has an account.
  if (signUp.data === 'check_email' || signUp.data === 'already_registered') {
    return (
      <AuthShell title={t('auth.signUp.title')} subtitle={t('auth.signUp.subtitle')} onBack={back} panel="signUp">
        <SignUpDone outcome={signUp.data} email={form.getValues('email').trim().toLowerCase()} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.signUp.title')} subtitle={t('auth.signUp.subtitle')} offer={offer} onBack={back} panel="signUp">
      <View style={styles.form}>
        <GoogleButton />
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
          onSubmitEditing={submit}
        />
        <Controller
          control={form.control}
          name="phone"
          render={({ field, fieldState }) => (
            <PhoneField
              value={field.value}
              onChange={field.onChange}
              label={t('auth.phone.label')}
              hint={t('auth.phone.hint')}
              error={fieldState.error?.message ? t(fieldState.error.message as 'validation.mobile') : undefined}
              testID="field-phone"
            />
          )}
        />
        <Controller
          control={form.control}
          name="whatsappOk"
          render={({ field }) => (
            <CheckRow label={t('auth.phone.whatsappOk')} value={field.value} onChange={field.onChange} testID="sign-up-whatsapp-ok" />
          )}
        />
        <FormError error={signUp.error} />
        <Text variant="small" color="textSecondary" align="center" testID="sign-up-offer-small">
          {offer}
        </Text>
        <Button label={t('auth.signUp.action')} onPress={submit} loading={signUp.isPending} testID="sign-up-submit" />
        <View style={styles.haveAccount}>
          <Text color="textSecondary">{t('auth.signUp.haveAccount')}</Text>
          <Link href="/sign-in" asChild>
            <Button variant="ghost" size="sm" label={t('auth.signUp.signIn')} testID="sign-up-to-sign-in" />
          </Link>
        </View>
        <Text variant="small" color="textSecondary" align="center">
          {t('legal.agree')}
        </Text>
        <View style={styles.legal}>
          <Link href="/terms" asChild>
            <Button variant="ghost" size="sm" label={t('legal.terms.title')} testID="sign-up-terms" />
          </Link>
          <Link href="/privacy" asChild>
            <Button variant="ghost" size="sm" label={t('legal.privacy.title')} testID="sign-up-privacy" />
          </Link>
        </View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  legal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  haveAccount: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
