import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useSession, useWorkspace } from '@/features/auth/session';
import { ModeCard } from '@/features/setup/ModeCard';
import { useSetBranchMode, useUpdateBranch } from '@/features/team/api';
import { spacing, type Mode } from '@/theme';
import {
  Button,
  FormError,
  FormMoneyField,
  FormTextField,
  HeaderBand,
  Screen,
  SectionHeader,
  SwitchRow,
  Text,
  useToast,
} from '@/ui';

import { OpeningCashCard } from './OpeningCashCard';

const whole = (min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, 'validation.number')
    .refine((v) => Number(v) >= min && Number(v) <= max, 'validation.range');

const schema = z
  .object({
    name: z.string().trim().min(2, 'validation.required').max(80, 'validation.tooLong'),
    address: z.string().trim().max(200),
    phone: z.string().trim().regex(/^$|^\+?[0-9 ]{7,20}$/, 'validation.phone'),
    vat_on: z.boolean(),
    trn: z.string().trim(),
    waiting_target_min: whole(1, 240),
    cancel_cutoff_hours: whole(0, 168),
    default_deposit_minor: z.number().int().min(0).nullable(),
    staff_can_sell: z.boolean(),
    block_insufficient_stock: z.boolean(),
  })
  .refine((v) => !v.vat_on || /^[0-9]{15}$/.test(v.trn), { path: ['trn'], message: 'validation.trn' });
type Values = z.infer<typeof schema>;

export function BranchSettingsScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { reload } = useSession();
  const { branch } = useWorkspace();
  const settings = branch.settings as Record<string, unknown>;
  const update = useUpdateBranch(branch.id);
  const setMode = useSetBranchMode(branch.id);
  const [nextMode, setNextMode] = useState<Mode | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: branch.name,
      address: branch.address ?? '',
      phone: branch.phone ?? '',
      vat_on: branch.vat_mode === 'on',
      trn: branch.trn ?? '',
      waiting_target_min: String(settings.waiting_target_min ?? 10),
      cancel_cutoff_hours: String(settings.cancel_cutoff_hours ?? 12),
      default_deposit_minor: Number(settings.default_deposit_minor ?? 0) || null,
      staff_can_sell: settings.staff_can_sell === true,
      block_insufficient_stock: settings.block_insufficient_stock === true,
    },
  });
  const vatOn = useWatch({ control: form.control, name: 'vat_on' });

  const submit = form.handleSubmit((v) =>
    update.mutate(
      {
        name: v.name,
        address: v.address,
        phone: v.phone,
        vat_mode: v.vat_on ? 'on' : 'off',
        trn: v.trn,
        settings: {
          waiting_target_min: Number(v.waiting_target_min),
          cancel_cutoff_hours: Number(v.cancel_cutoff_hours),
          default_deposit_minor: v.default_deposit_minor ?? 0,
          staff_can_sell: v.staff_can_sell,
          block_insufficient_stock: v.block_insufficient_stock,
        },
      },
      {
        onSuccess: () => {
          toast(t('branch.saved'));
          void reload();
        },
      },
    ),
  );

  const switchMode = () =>
    nextMode &&
    setMode.mutate(nextMode, {
      onSuccess: () => {
        toast(t('branch.modeSwitched', { mode: t(`auth.salonType.${nextMode}`) }));
        setNextMode(null);
        void reload();
      },
    });

  return (
    <Screen
      header={<HeaderBand title={t('branch.title')} subtitle={branch.name} onBack />}
      footer={<Button label={t('common.save')} onPress={submit} loading={update.isPending} testID="branch-save" />}
    >
      <View style={styles.body}>
        <View style={styles.section}>
          <SectionHeader title={t('branch.mode')} />
          <Text variant="small" color="textSecondary">
            {t('branch.modeHint')}
          </Text>
          {(['gents', 'ladies'] as const).map((mode) => (
            <ModeCard
              key={mode}
              mode={mode}
              selected={(nextMode ?? branch.mode) === mode}
              onPress={() => setNextMode(mode === branch.mode ? null : mode)}
              testID={`branch-mode-${mode}`}
            />
          ))}
          {nextMode ? (
            <Button
              label={t('branch.switchTo', { mode: t(`auth.salonType.${nextMode}`) })}
              variant="secondary"
              loading={setMode.isPending}
              onPress={switchMode}
              testID="branch-mode-confirm"
            />
          ) : null}
          <FormError error={setMode.error} />
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('branch.details')} />
          <FormTextField control={form.control} name="name" label={t('branch.fields.name')} />
          <FormTextField control={form.control} name="address" label={t('branch.fields.address')} />
          <FormTextField control={form.control} name="phone" label={t('branch.fields.phone')} keyboardType="phone-pad" />
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('branch.tax')} />
          <Controller
            control={form.control}
            name="vat_on"
            render={({ field }) => (
              <SwitchRow label={t('branch.fields.vat')} hint={t('branch.fields.vatHint')} value={field.value} onChange={field.onChange} testID="branch-vat" />
            )}
          />
          {vatOn ? (
            <FormTextField control={form.control} name="trn" label={t('branch.fields.trn')} keyboardType="number-pad" maxLength={15} />
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('branch.queue')} />
          <View style={styles.pair}>
            <View style={styles.flex}>
              <FormTextField control={form.control} name="waiting_target_min" label={t('branch.fields.waitTarget')} keyboardType="number-pad" />
            </View>
            <View style={styles.flex}>
              <FormTextField control={form.control} name="cancel_cutoff_hours" label={t('branch.fields.cutoff')} keyboardType="number-pad" />
            </View>
          </View>
          <FormMoneyField control={form.control} name="default_deposit_minor" label={t('branch.fields.deposit')} />
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('branch.rules')} />
          <Controller
            control={form.control}
            name="staff_can_sell"
            render={({ field }) => (
              <SwitchRow label={t('branch.fields.staffCanSell')} value={field.value} onChange={field.onChange} testID="branch-staff-sell" />
            )}
          />
          <Controller
            control={form.control}
            name="block_insufficient_stock"
            render={({ field }) => (
              <SwitchRow label={t('branch.fields.blockStock')} hint={t('branch.fields.blockStockHint')} value={field.value} onChange={field.onChange} />
            )}
          />
        </View>
        <FormError error={update.error} />

        <OpeningCashCard />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing['2xl'] },
  section: { gap: spacing.md },
  pair: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
