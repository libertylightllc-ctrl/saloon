import { Controller, useWatch, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { isUae } from '@/lib/countries';
import type { CurrencyCode } from '@/lib/currencies';
import { decimalsOf, formatMoney, secondTaxShare, vatFromInclusive, vatOnTop } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { Chip, FormTextField, SegmentTabs, SwitchRow, Text } from '@/ui';

import { TAX_KINDS, taxKindOf } from './kinds';
import { ProvincePicker } from './ProvincePicker';
import { useTaxWords, type TaxValues } from './taxForm';

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
      {country === 'CA' ? <ProvincePicker control={control} /> : null}
      <Controller
        control={control}
        name={field('tax_name')}
        render={({ field: f }) => <TaxKindPicker value={String(f.value ?? '')} onChange={f.onChange} control={control} />}
      />
      <FormTextField
        control={control}
        name={field('tax_rate')}
        label={t('tax.fields.rate')}
        hint={country === 'US' ? t('tax.rateHint.US') : undefined}
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
      {uae ? null : <SecondTax control={control} />}
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
  // Any name that is not one of the chips (an empty box too) is "Other"; a province picked above can change it.
  const other = kind === null;
  return (
    <View style={styles.kinds}>
      <Text variant="bodyStrong">{t('tax.fields.kind')}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {TAX_KINDS.map((k) => (
          <Chip
            key={k.key}
            label={t(`tax.kinds.${k.key}`)}
            selected={kind === k.key}
            onPress={() => onChange(k.name)}
            testID={`tax-kind-${k.key}`}
          />
        ))}
        <Chip
          label={t('tax.kinds.other')}
          selected={other}
          onPress={() => {
            if (!other) onChange('');
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

/** A second tax charged beside the first (Canada's PST, RST or QST next to the GST); receipts show each one. */
function SecondTax<T extends FieldValues & TaxValues>({ control }: { control: Control<T> }) {
  const { t } = useTranslation();
  const on = useWatch({ control, name: 'tax2_on' as FieldPath<T> }) as boolean;
  return (
    <View style={styles.box}>
      <Controller
        control={control}
        name={'tax2_on' as FieldPath<T>}
        render={({ field: f }) => (
          <SwitchRow label={t('tax.second.title')} hint={t('tax.second.hint')} value={Boolean(f.value)} onChange={f.onChange} testID="tax2-on" />
        )}
      />
      {on ? (
        <View style={styles.pair}>
          <View style={styles.flex}>
            <FormTextField control={control} name={'tax2_name' as FieldPath<T>} label={t('tax.fields.name')} maxLength={20} autoCapitalize="characters" />
          </View>
          <View style={styles.flex}>
            <FormTextField control={control} name={'tax2_rate' as FieldPath<T>} label={t('tax.fields.rate')} keyboardType="decimal-pad" maxLength={6} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** A small receipt for a 100 service with this tax (as the owner's sketch, 2026-10-19); each tax on its own line. */
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
  const rate2 = words.second?.rateBps ?? 0;
  const rate = words.rateBps === null ? null : words.rateBps + rate2;
  const amount = rate === null ? 0 : inclusive ? vatFromInclusive(price, rate) : vatOnTop(price, rate);
  const amount2 = rate === null ? 0 : secondTaxShare(amount, words.rateBps ?? 0, rate2);
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
      {row(t(inclusive ? 'tax.preview.included' : 'tax.preview.added', words), amount - amount2)}
      {words.second ? row(t(inclusive ? 'tax.preview.included' : 'tax.preview.added', words.second), amount2) : null}
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
  // Inputs line up even when one label takes two lines.
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  flex: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
});
