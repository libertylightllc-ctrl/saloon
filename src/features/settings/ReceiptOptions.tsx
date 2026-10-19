import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { RECEIPT_PAPERS, type ReceiptPaper } from '@/features/sales/receiptPaper';
import { spacing } from '@/theme';
import { PillTabs, Text } from '@/ui';

export const RECEIPT_MODES = ['off', 'simple', 'whatsapp'] as const;

export interface ReceiptOptionValues {
  receipt_mode: (typeof RECEIPT_MODES)[number];
  receipt_paper: ReceiptPaper;
}

/** Branch settings: the customer's receipt after a sale (none, printed, WhatsApp) and the paper it prints on. */
export function ReceiptOptions<T extends FieldValues & ReceiptOptionValues>({ control }: { control: Control<T> }) {
  const { t } = useTranslation();
  return (
    <View style={styles.block}>
      <Text variant="bodyStrong">{t('branch.receipt')}</Text>
      <Text variant="small" color="textSecondary">
        {t('branch.receiptHint')}
      </Text>
      <Controller
        control={control}
        name={'receipt_mode' as FieldPath<T>}
        render={({ field }) => (
          <PillTabs<ReceiptOptionValues['receipt_mode']>
            items={RECEIPT_MODES.map((key) => ({ key, label: t(`branch.receiptModes.${key}`) }))}
            value={field.value}
            onChange={field.onChange}
            testID="branch-receipt"
          />
        )}
      />
      <Text variant="bodyStrong">{t('branch.receiptPaper')}</Text>
      <Text variant="small" color="textSecondary">
        {t('branch.receiptPaperHint')}
      </Text>
      <Controller
        control={control}
        name={'receipt_paper' as FieldPath<T>}
        render={({ field }) => (
          <PillTabs<ReceiptPaper>
            items={RECEIPT_PAPERS.map((key) => ({ key, label: t(`branch.receiptPapers.${key}`) }))}
            value={field.value}
            onChange={field.onChange}
            testID="branch-paper"
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
});
