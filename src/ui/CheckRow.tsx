import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

/** A tick box with its sentence ("I confirm the count was done with the drawer closed to sales"). */
export function CheckRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      role="checkbox"
      aria-checked={value}
      aria-label={label}
      onPress={() => onChange(!value)}
      style={styles.row}
      testID={testID}
    >
      <View
        style={[
          styles.box,
          { borderColor: value ? theme.colors.primary500 : theme.colors.border, borderRadius: theme.radius.sm - 2 },
          value && { backgroundColor: theme.colors.primary500 },
        ]}
      >
        {value ? <Icon name="check" size={16} color={theme.colors.onPrimary} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  box: { width: 24, height: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
