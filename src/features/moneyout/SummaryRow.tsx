import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Text } from '@/ui';

/** A label and an amount on one line (bill summaries); `strong` for totals. */
export function SummaryRow({
  label,
  value,
  strong,
  testID,
}: {
  label: string;
  value: string;
  strong?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.row}>
      <Text
        variant={strong ? 'bodyStrong' : 'body'}
        color={strong ? 'text' : 'textSecondary'}
        style={styles.flex}
      >
        {label}
      </Text>
      <Text variant={strong ? 'h4' : 'bodyStrong'} tabular testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
