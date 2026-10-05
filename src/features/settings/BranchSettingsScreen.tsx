import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useSession, useWorkspace } from '@/features/auth/session';
import { ModeCard } from '@/features/setup/ModeCard';
import { TaxFields, taxShape, trnValid } from '@/features/tax/TaxFields';
import { useSetBranchMode, useUpdateBranch } from '@/features/team/api';
import { isUae } from '@/lib/countries';
import { activeCurrency, formatBps, parseTaxRate } from '@/lib/money';
import { spacing, type Mode } from '@/theme';
import {
  Button,
  FormError,
  FormMoneyField,
  FormTextField,
  HeaderBand,
  PillTabs,
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

const schemaFor = (uae: boolean) =>
  z
    .object({
      name: z.string().trim().min(2, 'validation.required').max(80, 'validation.tooLong'),
      address: z.string().trim().max(200),
      phone: z.string().trim().regex(/^$|^\+?[0-9 ]{7,20}$/, 'validation.phone'),
      vat_on: z.boolean(),
      ...taxShape,
      waiting_target_min: whole(1, 240),
      cancel_cutoff_hours: whole(0, 168),
      default_deposit_minor: z.number().int().min(0).nullable(),
      staff_can_sell: z.boolean(),
      block_insufficient_stock: z.boolean(),
      late_grace_min: whole(0, 120),
      require_hygiene_evidence: z.boolean(),
      receipt_mode: z.enum(['off', 'simple', 'whatsapp']),
    })
    .refine((v) => !v.vat_on || trnValid(v.trn, uae), { path: ['trn'], message: uae ? 'validation.trn' : 'validation.taxNumber' });
type Values = z.infer<ReturnType<typeof schemaFor>>;

/** 887.5 → "8.875" for the rate field. */
const rateText = (bps: number) => formatBps(bps).replace('%', '');

export function BranchSettingsScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { reload } = useSession();
  const { business, branch } = useWorkspace();
  const uae = isUae(business.country_code);
  const schema = useMemo(() => schemaFor(uae), [uae]);
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
      tax_name: branch.tax_name,
      tax_rate: rateText(branch.tax_rate_bps),
      tax_inclusive: branch.tax_inclusive,
      tax_id_label: branch.tax_id_label,
      waiting_target_min: String(settings.waiting_target_min ?? 10),
      cancel_cutoff_hours: String(settings.cancel_cutoff_hours ?? 12),
      default_deposit_minor: Number(settings.default_deposit_minor ?? 0) || null,
      staff_can_sell: settings.staff_can_sell === true,
      block_insufficient_stock: settings.block_insufficient_stock === true,
      late_grace_min: String(settings.late_grace_min ?? 10),
      require_hygiene_evidence: settings.require_hygiene_evidence === true,
      receipt_mode: (['off', 'simple', 'whatsapp'] as const).find((m) => m === settings.receipt_mode) ?? 'simple',
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
        tax_name: v.tax_name,
        tax_rate_bps: parseTaxRate(v.tax_rate),
        tax_inclusive: v.tax_inclusive,
        tax_id_label: v.tax_id_label,
        settings: {
          waiting_target_min: Number(v.waiting_target_min),
          cancel_cutoff_hours: Number(v.cancel_cutoff_hours),
          default_deposit_minor: v.default_deposit_minor ?? 0,
          staff_can_sell: v.staff_can_sell,
          block_insufficient_stock: v.block_insufficient_stock,
          late_grace_min: Number(v.late_grace_min),
          require_hygiene_evidence: v.require_hygiene_evidence,
          receipt_mode: v.receipt_mode,
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
          {vatOn ? <TaxFields control={form.control} uae={uae} currency={activeCurrency()} /> : null}
          <Text variant="bodyStrong">{t('branch.receipt')}</Text>
          <Text variant="small" color="textSecondary">
            {t('branch.receiptHint')}
          </Text>
          <Controller
            control={form.control}
            name="receipt_mode"
            render={({ field }) => (
              <PillTabs<Values['receipt_mode']>
                items={(['off', 'simple', 'whatsapp'] as const).map((key) => ({ key, label: t(`branch.receiptModes.${key}`) }))}
                value={field.value}
                onChange={field.onChange}
                testID="branch-receipt"
              />
            )}
          />
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
          <FormTextField control={form.control} name="late_grace_min" label={t('branch.fields.lateGrace')} hint={t('branch.fields.lateGraceHint')} keyboardType="number-pad" />
          <Controller
            control={form.control}
            name="require_hygiene_evidence"
            render={({ field }) => (
              <SwitchRow label={t('branch.fields.hygienePhoto')} hint={t('branch.fields.hygienePhotoHint')} value={field.value} onChange={field.onChange} testID="branch-hygiene-photo" />
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
  // Inputs line up even when one label takes two lines.
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  flex: { flex: 1 },
});
