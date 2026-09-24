import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Button } from './Button';
import { Illustration, type IllustrationName } from './Illustration';
import { Text } from './Text';

export interface EmptyStateProps {
  illustration: IllustrationName;
  /** One line that says what to do: "No one is waiting. Add a walk-in." */
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ illustration, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Illustration name={illustration} size={140} />
      <Text align="center" color="textSecondary" style={styles.message}>
        {message}
      </Text>
      {actionLabel ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" size="md" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing['3xl'] },
  message: { maxWidth: 280 },
});
