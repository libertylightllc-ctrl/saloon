import { useRouter } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useSalonType } from '@/features/auth/salonType';
import { useSession } from '@/features/auth/session';
import { useIsPlatformAdmin } from '@/features/plan/api';
import { TaxFields, taxShape, trnValid, useTaxWords } from '@/features/tax/TaxFields';
import { isUae } from '@/lib/countries';
import { isCurrency } from '@/lib/currencies';
import { parseTaxRate, setActiveCurrency } from '@/lib/money';
import { asJson, supabase } from '@/lib/supabase';
import { spacing } from '@/theme';
import {
  Button,
  FormDaysField,
  FormError,
  FormMoneyField,
  FormTextField,
  HeaderBand,
  ProgressDashes,
  Screen,
  SwitchRow,
  Text,
} from '@/ui';

import { CountryStep, countryDefaults, guessCountry } from './CountryStep';
import { ModeCard } from './ModeCard';

/** "Asia/Dubai", "America/Argentina/Buenos_Aires", "UTC"; the server checks it is a real one. */
const ZONE = /^(UTC|[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+)$/;

const schema = z
  .object({
    businessName: z.string().trim().min(2, 'validation.name'),
    ownerName: z.string().trim().min(2, 'validation.name'),
    country: z.string().regex(/^[A-Z]{2}$/),
    currency: z.string().regex(/^[A-Z]{3}$/, 'validation.required'),
    timezone: z.string().trim().regex(ZONE, 'validation.timezone'),
    mode: z.enum(['gents', 'ladies']),
    branchName: z.string().trim().max(80),
    address: z.string().trim().max(160),
    phone: z.string().trim().regex(/^$|^\+?[0-9 ]{7,20}$/, 'validation.phone'),
    days: z.array(z.number()).min(1, 'validation.days'),
    vat: z.enum(['off', 'on']),
    ...taxShape,
    openingCash: z.number().int().min(0).nullable(),
  })
  .refine((v) => v.vat === 'off' || !isUae(v.country) || trnValid(v.trn, true), { message: 'validation.trn', path: ['trn'] })
  .refine((v) => v.vat === 'off' || isUae(v.country) || trnValid(v.trn, false), { message: 'validation.taxNumber', path: ['trn'] });

type Values = z.infer<typeof schema>;

const STEPS: { key: 'business' | 'country' | 'mode' | 'branch' | 'tax'; fields: FieldPath<Values>[] }[] = [
  { key: 'business', fields: ['businessName', 'ownerName'] },
  { key: 'country', fields: ['country', 'currency', 'timezone'] },
  { key: 'mode', fields: ['mode'] },
  { key: 'branch', fields: ['branchName', 'address', 'phone', 'days'] },
  { key: 'tax', fields: ['vat', 'tax_name', 'tax_rate', 'tax_inclusive', 'tax_id_label', 'trn', 'openingCash'] },
];


export function SetupWizard() {
  const { t } = useTranslation();
  const { session, reload, signOut } = useSession();
  const router = useRouter();
  const platformAdmin = useIsPlatformAdmin();
  const { salonType, setSalonType } = useSalonType();
  const [step, setStep] = useState(0);
  // Email sign-up stores display_name; Google gives full_name / name.
  const meta = session?.user.user_metadata ?? {};
  const suggestedName = String(meta.display_name ?? meta.full_name ?? meta.name ?? '');
  // The country where the phone is, with its currency, time zone and sales tax; the owner can pick another.
  const [where] = useState(() => countryDefaults(guessCountry()));

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: '',
      ownerName: suggestedName,
      ...where,
      mode: salonType ?? 'gents',
      branchName: '',
      address: '',
      phone: '',
      days: [0, 1, 2, 3, 4, 5, 6],
      vat: 'off',
      trn: '',
      openingCash: null,
    },
  });
  useEffect(() => setActiveCurrency(where.currency), [where.currency]);

  const create = useMutation({
    mutationFn: async (v: Values) => {
      const { error } = await supabase.rpc('create_business', {
        p: asJson({
          business_name: v.businessName,
          owner_name: v.ownerName,
          mode: v.mode,
          branch_name: v.branchName || v.businessName,
          address: v.address,
          phone: v.phone,
          // Open days only: no opening and closing times (owner, 2026-10-07).
          opening_hours: { days: v.days },
          country_code: v.country,
          currency: v.currency,
          timezone: v.timezone,
          vat_mode: v.vat,
          tax_name: v.tax_name,
          tax_rate_bps: parseTaxRate(v.tax_rate),
          tax_inclusive: v.tax_inclusive,
          tax_id_label: isUae(v.country) ? 'TRN' : v.tax_id_label,
          trn: v.vat === 'on' ? v.trn : null,
          opening_cash_minor: v.openingCash ?? 0,
        }),
      });
      if (error) throw error;
    },
    onSuccess: () => reload(),
  });

  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;
  const next = async () => {
    if (!(await form.trigger(current.fields))) return;
    if (last) form.handleSubmit((v) => create.mutate(v))();
    else setStep(step + 1);
  };
  const vat = useWatch({ control: form.control, name: 'vat' });
  const [country, currency] = useWatch({ control: form.control, name: ['country', 'currency'] });
  const words = useTaxWords(form.control);

  return (
    <Screen
      background="gradient"
      header={
        <HeaderBand
          title={t('setup.title')}
          subtitle={t(`setup.steps.${current.key}.subtitle`)}
          onBack={step > 0 ? () => setStep(step - 1) : () => void signOut()}
        >
          <View style={styles.dashes}>
            <ProgressDashes total={STEPS.length} current={step} />
          </View>
        </HeaderBand>
      }
      footer={
        <Button
          label={last ? t('setup.create') : t('setup.next')}
          onPress={next}
          loading={create.isPending}
          testID="setup-next"
        />
      }
    >
      <View style={styles.body}>
        {/* A platform owner needs no salon of their own: the console is one tap away. */}
        {platformAdmin.data && step === 0 ? (
          <Button label={t('console.open')} icon="building" variant="secondary" onPress={() => router.push('/console')} testID="setup-console" />
        ) : null}
        <Text variant="h2">{t(`setup.steps.${current.key}.title`)}</Text>

        {current.key === 'business' ? (
          <>
            <FormTextField control={form.control} name="businessName" label={t('setup.fields.businessName')} />
            <FormTextField control={form.control} name="ownerName" label={t('auth.fields.yourName')} />
          </>
        ) : null}

        {current.key === 'country' ? <CountryStep control={form.control} setValue={form.setValue} /> : null}

        {current.key === 'mode' ? (
          <Controller
            control={form.control}
            name="mode"
            render={({ field }) => (
              <View style={styles.modes}>
                {(['gents', 'ladies'] as const).map((mode) => (
                  <ModeCard
                    key={mode}
                    mode={mode}
                    testID={`setup-mode-${mode}`}
                    selected={field.value === mode}
                    onPress={() => {
                      field.onChange(mode);
                      setSalonType(mode); // the wizard re-themes live
                    }}
                  />
                ))}
              </View>
            )}
          />
        ) : null}

        {current.key === 'branch' ? (
          <>
            <FormTextField
              control={form.control}
              name="branchName"
              label={t('setup.fields.branchName')}
              hint={t('setup.fields.branchNameHint')}
            />
            <FormTextField control={form.control} name="address" label={t('setup.fields.address')} />
            <FormTextField control={form.control} name="phone" label={t('setup.fields.phone')} keyboardType="phone-pad" />
            <FormDaysField control={form.control} name="days" label={t('setup.fields.days')} />
          </>
        ) : null}

        {current.key === 'tax' ? (
          <>
            <Controller
              control={form.control}
              name="vat"
              render={({ field }) => (
                <SwitchRow
                  label={t('setup.tax.on', words)}
                  hint={t(field.value === 'on' ? 'setup.tax.onDetail' : 'setup.tax.offDetail', words)}
                  value={field.value === 'on'}
                  onChange={(on) => field.onChange(on ? 'on' : 'off')}
                  testID="setup-vat"
                />
              )}
            />
            {vat === 'on' ? (
              <TaxFields control={form.control} uae={isUae(country)} currency={isCurrency(currency) ? currency : 'AED'} />
            ) : null}
            <FormMoneyField
              control={form.control}
              name="openingCash"
              label={t('setup.fields.openingCash')}
              hint={t('setup.fields.openingCashHint')}
            />
            <FormError error={create.error} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  dashes: { alignItems: 'center' },
  modes: { gap: spacing.md },
});
