import { StyleSheet, Switch, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Text } from './Text';

export function SwitchRow({
  label,
  hint,
  value,
  onChange,
  disabled,
  testID,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text variant="bodyStrong">{label}</Text>
        {hint ? (
          <Text variant="small" color="textSecondary">
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary400 }}
        thumbColor={value ? theme.colors.primary500 : theme.colors.surface}
        ios_backgroundColor={theme.colors.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  text: { flex: 1, gap: 2 },
});
