import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';
import { Text } from '@/ui';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: theme.colors.divider }]}>
      <Text variant="h3" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export const galleryStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  column: { gap: spacing.md },
  flex: { flex: 1 },
});

const styles = StyleSheet.create({
  section: { gap: spacing.lg, paddingTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth },
});
