import { Controller, useWatch, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import type { CurrencyCode } from '@/lib/currencies';
import { decimalsOf, formatBps, formatMoney, parseTaxRate, vatFromInclusive, vatOnTop } from '@/lib/money';
import { spacing } from '@/theme';
import { FormTextField, SegmentTabs, Text } from '@/ui';

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
    tax: name?.trim() && name.trim() !== 'VAT' ? name.trim() : t('tax.vat'),
    taxId: idLabel?.trim() && idLabel.trim() !== 'TRN' ? idLabel.trim() : t('tax.trn'),
    rate: rate === null ? '–' : formatBps(rate),
    rateBps: rate,
  };
}

export function TaxFields<T extends FieldValues & TaxValues>({
  control,
  uae,
  currency,
}: {
  control: Control<T>;
  uae: boolean;
  currency: CurrencyCode;
}) {
  const { t } = useTranslation();
  const words = useTaxWords(control);
  const inclusive = useWatch({ control, name: 'tax_inclusive' as FieldPath<T> }) as boolean;
  const price = 100 * 10 ** decimalsOf(currency);
  const amount =
    words.rateBps === null ? 0 : inclusive ? vatFromInclusive(price, words.rateBps) : vatOnTop(price, words.rateBps);
  const field = (name: keyof TaxValues) => name as FieldPath<T>;

  return (
    <View style={styles.box}>
      <View style={styles.pair}>
        <View style={styles.wide}>
          <FormTextField control={control} name={field('tax_name')} label={t('tax.fields.name')} maxLength={20} />
        </View>
        <View style={styles.flex}>
          <FormTextField
            control={control}
            name={field('tax_rate')}
            label={t('tax.fields.rate')}
            keyboardType="decimal-pad"
            maxLength={6}
          />
        </View>
      </View>
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
      <Text variant="small" color="textSecondary" testID="tax-example">
        {t(inclusive ? 'tax.exampleIncluded' : 'tax.exampleAdded', {
          ...words,
          price: formatMoney(price, currency),
          amount: formatMoney(amount, currency),
          total: formatMoney(price + amount, currency),
        })}
      </Text>
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

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  pair: { flexDirection: 'row', gap: spacing.md },
  wide: { flex: 2 },
  flex: { flex: 1 },
});
