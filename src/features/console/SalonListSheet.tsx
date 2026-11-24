import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { BottomSheet, ListRow, Text } from '@/ui';

export interface SalonLine {
  key: string;
  title: string;
  meta: string[];
  onPress?: () => void;
}

/**
 * A list of salons behind an Overview card (owner's brief, Part B): those that stopped paying, those at risk. A row
 * opens the salon in Salons.
 */
export function SalonListSheet({
  open,
  title,
  lines,
  note,
  onClose,
  testID,
}: {
  open: boolean;
  title: string;
  lines: SalonLine[];
  note?: string;
  onClose: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <View style={styles.body} testID={testID}>
        {lines.length === 0 ? <Text color="textSecondary">{t('console.overview.none')}</Text> : null}
        {lines.map((l) => (
          <ListRow key={l.key} title={l.title} meta={l.meta} chevron={Boolean(l.onPress)} onPress={l.onPress} testID={`${testID ?? 'salon-list'}-${l.key}`} />
        ))}
        {note ? (
          <Text variant="small" color="textSecondary">
            {note}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: spacing.sm } });
