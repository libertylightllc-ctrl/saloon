import { useState } from 'react';
import { Controller, useWatch, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { isUae } from '@/lib/countries';
import type { CurrencyCode } from '@/lib/currencies';
import { taxDisplayName } from '@/lib/i18n';
import { decimalsOf, formatBps, formatMoney, parseTaxRate, vatFromInclusive, vatOnTop } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { Chip, FormTextField, SegmentTabs, Text } from '@/ui';

import { TAX_KINDS, taxKindOf } from './kinds';

/** The tax fields of a form (setup, branch settings); the on/off switch stays with the screen. */
export const taxShape = {
  tax_name: z.string().trim().min(1, 'validation.required').max(20, 'validation.tooLong'),
  tax_rate: z
    .string()
    .trim()
    .refine((v) => parseTaxRate(v) !== null, 'validation.taxRate'),
  tax_inclusive: z.boolean(),
  tax_id_label: z.string().trim().min(1, 'validation.required').max(20, 'validation.tooLong'),
  trn: z.string().trim(),
};

export interface TaxValues {
  tax_name: string;
  tax_rate: string;
  tax_inclusive: boolean;
  tax_id_label: string;
  trn: string;
}

/** The UAE TRN is 15 digits; elsewhere any tax number, or none yet (the server checks the same). */
export function trnValid(trn: string, uae: boolean): boolean {
  return uae ? /^[0-9]{15}$/.test(trn) : trn === '' || /^[A-Za-z0-9][A-Za-z0-9 ./-]{1,28}[A-Za-z0-9]$/.test(trn);
}

/** What the tax words read while the owner is typing them (the branch's own words apply once saved). */
export function useTaxWords<T extends FieldValues & TaxValues>(control: Control<T>) {
  const { t } = useTranslation();
  const [name, rateText, idLabel] = useWatch({
    control,
    name: ['tax_name', 'tax_rate', 'tax_id_label'] as FieldPath<T>[],
  }) as string[];
  const rate = parseTaxRate(rateText ?? '');
  return {
    tax: name?.trim() ? taxDisplayName(name.trim()) : t('tax.kinds.vat'),
    taxId: idLabel?.trim() && idLabel.trim() !== 'TRN' ? idLabel.trim() : t('tax.trn'),
    rate: rate === null ? '–' : formatBps(rate),
    rateBps: rate,
  };
}

/** Countries where the rate depends on the state, province or city: the owner enters the one they charge. */
const LOCAL_RATES = new Set(['US', 'CA']);

export function TaxFields<T extends FieldValues & TaxValues>({
  control,
  country,
  currency,
}: {
  control: Control<T>;
  country: string;
  currency: CurrencyCode;
}) {
  const { t } = useTranslation();
  const uae = isUae(country);
  const words = useTaxWords(control);
  const inclusive = useWatch({ control, name: 'tax_inclusive' as FieldPath<T> }) as boolean;
  const field = (name: keyof TaxValues) => name as FieldPath<T>;

  return (
    <View style={styles.box}>
      <Controller
        control={control}
        name={field('tax_name')}
        render={({ field: f }) => <TaxKindPicker value={String(f.value ?? '')} onChange={f.onChange} control={control} />}
      />
      <FormTextField
        control={control}
        name={field('tax_rate')}
        label={t('tax.fields.rate')}
        hint={LOCAL_RATES.has(country) ? t(`tax.rateHint.${country as 'US' | 'CA'}`) : undefined}
        keyboardType="decimal-pad"
        maxLength={6}
      />
      <Controller
        control={control}
        name={field('tax_inclusive')}
        render={({ field: f }) => (
          <SegmentTabs<'in' | 'add'>
            items={[
              { key: 'in', label: t('tax.inclusive') },
              { key: 'add', label: t('tax.added') },
            ]}
            value={f.value ? 'in' : 'add'}
            onChange={(v) => f.onChange(v === 'in')}
            testID="tax-inclusive"
          />
        )}
      />
      <TaxPreview currency={currency} inclusive={inclusive} words={words} />
      {uae ? null : (
        <FormTextField control={control} name={field('tax_id_label')} label={t('tax.fields.idLabel')} maxLength={20} />
      )}
      <FormTextField
        control={control}
        name={field('trn')}
        label={t(uae ? 'tax.fields.numberUae' : 'tax.fields.number', words)}
        hint={uae ? undefined : t('tax.fields.numberHint')}
        keyboardType={uae ? 'number-pad' : 'default'}
        autoCapitalize="characters"
        maxLength={uae ? 15 : 30}
      />
    </View>
  );
}

/** VAT · GST · Sales tax · Service tax · Other: the usual kinds as chips; "Other" asks for the name. */
function TaxKindPicker<T extends FieldValues & TaxValues>({
  value,
  onChange,
  control,
}: {
  value: string;
  onChange: (name: string) => void;
  control: Control<T>;
}) {
  const { t } = useTranslation();
  const kind = taxKindOf(value);
  // "Other" stays open once picked, even while its box is still empty.
  const [other, setOther] = useState(kind === null);
  return (
    <View style={styles.kinds}>
      <Text variant="bodyStrong">{t('tax.fields.kind')}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {TAX_KINDS.map((k) => (
          <Chip
            key={k.key}
            label={t(`tax.kinds.${k.key}`)}
            selected={!other && kind === k.key}
            onPress={() => {
              setOther(false);
              onChange(k.name);
            }}
            testID={`tax-kind-${k.key}`}
          />
        ))}
        <Chip
          label={t('tax.kinds.other')}
          selected={other}
          onPress={() => {
            if (!other) onChange(kind === null ? value : '');
            setOther(true);
          }}
          testID="tax-kind-other"
        />
      </View>
      {other ? (
        <FormTextField control={control} name={'tax_name' as FieldPath<T>} label={t('tax.fields.name')} maxLength={20} />
      ) : null}
    </View>
  );
}

/** A small receipt for a 100 service with this tax (as the owner's sketch, 2026-10-19). */
function TaxPreview({
  currency,
  inclusive,
  words,
}: {
  currency: CurrencyCode;
  inclusive: boolean;
  words: ReturnType<typeof useTaxWords>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const price = 100 * 10 ** decimalsOf(currency);
  const amount = words.rateBps === null ? 0 : inclusive ? vatFromInclusive(price, words.rateBps) : vatOnTop(price, words.rateBps);
  const total = inclusive ? price : price + amount;
  const row = (label: string, value: number, strong = false) => (
    <View style={styles.row}>
      <Text variant={strong ? 'bodyStrong' : 'body'} color={strong ? 'text' : 'textOnTint'} style={styles.flex}>
        {label}
      </Text>
      <Text variant={strong ? 'bodyStrong' : 'body'} tabular>
        {formatMoney(value, currency)}
      </Text>
    </View>
  );
  return (
    <View style={[styles.preview, { backgroundColor: theme.colors.primary50, borderRadius: theme.radius.md }]} testID="tax-example">
      {row(t('tax.preview.service'), price)}
      {row(t(inclusive ? 'tax.preview.included' : 'tax.preview.added', words), amount)}
      <View style={[styles.rule, { backgroundColor: theme.colors.divider }]} />
      {row(t('tax.preview.total'), total, true)}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  kinds: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preview: { padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
});
