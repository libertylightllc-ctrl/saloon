import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useSalonType } from '@/features/auth/salonType';
import { useSession } from '@/features/auth/session';
import { asJson, supabase } from '@/lib/supabase';
import { spacing, useTheme } from '@/theme';
import {
  Button,
  Card,
  Chip,
  FormError,
  FormMoneyField,
  FormTextField,
  HeaderBand,
  Icon,
  ProgressDashes,
  Screen,
  SegmentTabs,
  Text,
} from '@/ui';

import { ModeCard } from './ModeCard';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const schema = z
  .object({
    businessName: z.string().trim().min(2, 'validation.name'),
    ownerName: z.string().trim().min(2, 'validation.name'),
    mode: z.enum(['gents', 'ladies']),
    branchName: z.string().trim().max(80),
    address: z.string().trim().max(160),
    phone: z.string().trim().regex(/^$|^\+?[0-9 ]{7,20}$/, 'validation.phone'),
    opens: z.string().regex(TIME, 'validation.time'),
    closes: z.string().regex(TIME, 'validation.time'),
    days: z.array(z.number()).min(1, 'validation.days'),
    vat: z.enum(['off', 'on']),
    trn: z.string().trim(),
    openingCash: z.number().int().min(0).nullable(),
  })
  .refine((v) => v.closes > v.opens, { message: 'validation.hours', path: ['closes'] })
  .refine((v) => v.vat === 'off' || /^\d{15}$/.test(v.trn), { message: 'validation.trn', path: ['trn'] });

type Values = z.infer<typeof schema>;

const STEPS: { key: 'business' | 'country' | 'mode' | 'branch' | 'tax'; fields: FieldPath<Values>[] }[] = [
  { key: 'business', fields: ['businessName', 'ownerName'] },
  { key: 'country', fields: [] },
  { key: 'mode', fields: ['mode'] },
  { key: 'branch', fields: ['branchName', 'address', 'phone', 'opens', 'closes', 'days'] },
  { key: 'tax', fields: ['vat', 'trn', 'openingCash'] },
];

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function SetupWizard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session, reload, signOut } = useSession();
  const { salonType, setSalonType } = useSalonType();
  const [step, setStep] = useState(0);
  const suggestedName = String(session?.user.user_metadata?.display_name ?? '');

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: '',
      ownerName: suggestedName,
      mode: salonType ?? 'gents',
      branchName: '',
      address: '',
      phone: '',
      opens: '09:00',
      closes: '22:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      vat: 'off',
      trn: '',
      openingCash: null,
    },
  });

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
          opening_hours: { open: v.opens, close: v.closes, days: v.days },
          vat_mode: v.vat,
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
        <Text variant="h2">{t(`setup.steps.${current.key}.title`)}</Text>

        {current.key === 'business' ? (
          <>
            <FormTextField control={form.control} name="businessName" label={t('setup.fields.businessName')} />
            <FormTextField control={form.control} name="ownerName" label={t('auth.fields.yourName')} />
          </>
        ) : null}

        {current.key === 'country' ? (
          <Card variant="outlined" style={styles.row}>
            <Icon name="mapPin" size={22} color={theme.colors.primary500} />
            <View style={styles.flex}>
              <Text variant="h4">{t('setup.country.uae')}</Text>
              <Text variant="small" color="textSecondary">
                {t('setup.country.detail')}
              </Text>
            </View>
            <Icon name="check" size={20} color={theme.colors.primary500} />
          </Card>
        ) : null}

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
            <View style={styles.pair}>
              <View style={styles.flex}>
                <FormTextField control={form.control} name="opens" label={t('setup.fields.opens')} placeholder="09:00" />
              </View>
              <View style={styles.flex}>
                <FormTextField control={form.control} name="closes" label={t('setup.fields.closes')} placeholder="22:00" />
              </View>
            </View>
            <Controller
              control={form.control}
              name="days"
              render={({ field, fieldState }) => (
                <View style={styles.days}>
                  <Text variant="bodyStrong">{t('setup.fields.days')}</Text>
                  <View style={styles.wrap}>
                    {WEEKDAYS.map((day, i) => {
                      const on = field.value.includes(i);
                      return (
                        <Chip
                          key={day}
                          label={t(`common.days.${day}`)}
                          selected={on}
                          onPress={() => field.onChange(on ? field.value.filter((d) => d !== i) : [...field.value, i])}
                        />
                      );
                    })}
                  </View>
                  {fieldState.error?.message ? (
                    <Text variant="small" color="primaryText">
                      {t(fieldState.error.message as 'validation.days')}
                    </Text>
                  ) : null}
                </View>
              )}
            />
          </>
        ) : null}

        {current.key === 'tax' ? (
          <>
            <Controller
              control={form.control}
              name="vat"
              render={({ field }) => (
                <SegmentTabs<'off' | 'on'>
                  items={[
                    { key: 'off', label: t('setup.tax.off') },
                    { key: 'on', label: t('setup.tax.on') },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                  testID="setup-vat"
                />
              )}
            />
            <Text variant="small" color="textSecondary">
              {t(vat === 'on' ? 'setup.tax.onDetail' : 'setup.tax.offDetail')}
            </Text>
            {vat === 'on' ? (
              <FormTextField
                control={form.control}
                name="trn"
                label={t('setup.fields.trn')}
                keyboardType="number-pad"
                maxLength={15}
              />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  modes: { gap: spacing.md },
  pair: { flexDirection: 'row', gap: spacing.md },
  days: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
