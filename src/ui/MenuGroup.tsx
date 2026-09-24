import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Card } from './Card';
import { Text } from './Text';

/**
 * A titled group of MenuRows. On the gents lavender body the rows sit on a white card (as on the
 * Barber kit's Profile sheet); on the ladies white sheet they sit directly on it.
 */
export function MenuGroup({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useTheme();
  const onCard = theme.variants.body === 'plain';
  return (
    <View style={styles.group}>
      {title ? (
        <Text variant="small" color={onCard ? 'textOnTint' : 'textSecondary'}>
          {title}
        </Text>
      ) : null}
      {onCard ? (
        <Card padding={0} style={styles.card}>
          {children}
        </Card>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  card: { paddingHorizontal: spacing.lg },
});
