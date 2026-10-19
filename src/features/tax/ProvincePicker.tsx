import { useController, type Control, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { semantic, spacing } from '@/theme';
import { Chip, Text } from '@/ui';

import { PROVINCES } from './provinces';
import { rateText, type TaxValues } from './taxForm';

/**
 * Canada: the province fills in its tax (Ontario HST 13%; British Columbia GST 5% + PST 7%…), added at the till. The
 * owner can still change the fields below it.
 */
export function ProvincePicker<T extends FieldValues & TaxValues>({ control }: { control: Control<T> }) {
  const { t } = useTranslation();
  const c = control as unknown as Control<TaxValues>;
  const { field: region, fieldState } = useController({ control: c, name: 'tax_region' });
  const name = useController({ control: c, name: 'tax_name' }).field;
  const rate = useController({ control: c, name: 'tax_rate' }).field;
  const inclusive = useController({ control: c, name: 'tax_inclusive' }).field;
  const on2 = useController({ control: c, name: 'tax2_on' }).field;
  const name2 = useController({ control: c, name: 'tax2_name' }).field;
  const rate2 = useController({ control: c, name: 'tax2_rate' }).field;

  return (
    <View style={styles.box}>
      <Text variant="bodyStrong">{t('tax.province.title')}</Text>
      <Text variant="small" color="textSecondary">
        {t('tax.province.hint')}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {PROVINCES.map((p) => (
          <Chip
            key={p.code}
            label={t(`tax.province.names.${p.code}`)}
            selected={region.value === p.code}
            onPress={() => {
              region.onChange(p.code);
              name.onChange(p.tax.name);
              rate.onChange(rateText(p.tax.rateBps));
              inclusive.onChange(false);
              on2.onChange(Boolean(p.second));
              name2.onChange(p.second?.name ?? '');
              rate2.onChange(p.second ? rateText(p.second.rateBps) : '');
            }}
            testID={`tax-province-${p.code}`}
          />
        ))}
      </View>
      {/* Setup checks a step at a time and does not check again on a change: the message goes once a province is picked. */}
      {fieldState.error?.message && !region.value ? (
        <Text variant="small" style={{ color: semantic.error.hover }} accessibilityLiveRegion="polite" testID="tax-province-error">
          {t(fieldState.error.message as 'validation.province')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
