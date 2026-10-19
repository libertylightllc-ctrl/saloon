/**
 * What every receipt and tax invoice says about the seller besides the tax number (owner, 2026-10-19: "CR number,
 * licence register number is also important"): the registered company name when it differs from the salon's, and the
 * trade licence / commercial registration number with what it is called there. All optional.
 */
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { spacing } from '@/theme';
import { FormTextField, Text } from '@/ui';

export const sellerShape = {
  legal_name: z.string().trim().max(120, 'validation.tooLong'),
  licence_label: z.string().trim().max(30, 'validation.tooLong'),
  licence_number: z
    .string()
    .trim()
    .regex(/^$|^[A-Za-z0-9]([A-Za-z0-9 ./-]{0,38}[A-Za-z0-9])?$/, 'validation.licence'),
};

export interface SellerValues {
  legal_name: string;
  licence_label: string;
  licence_number: string;
}

export function SellerFields<T extends FieldValues & SellerValues>({ control }: { control: Control<T> }) {
  const { t } = useTranslation();
  const field = (name: keyof SellerValues) => name as FieldPath<T>;
  return (
    <View style={styles.box} testID="seller-fields">
      <Text variant="bodyStrong">{t('branch.seller.title')}</Text>
      <Text variant="small" color="textSecondary">
        {t('branch.seller.hint')}
      </Text>
      <FormTextField
        control={control}
        name={field('legal_name')}
        label={t('branch.seller.legalName')}
        hint={t('branch.seller.legalNameHint')}
        maxLength={120}
      />
      <View style={styles.pair}>
        <View style={styles.flex}>
          <FormTextField control={control} name={field('licence_label')} label={t('branch.seller.licenceLabel')} maxLength={30} />
        </View>
        <View style={styles.wide}>
          <FormTextField
            control={control}
            name={field('licence_number')}
            label={t('branch.seller.licenceNumber')}
            autoCapitalize="characters"
            maxLength={40}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  // Inputs line up even when one label takes two lines.
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  flex: { flex: 1 },
  wide: { flex: 1.4 },
});
