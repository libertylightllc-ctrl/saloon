import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Button } from './Button';
import { FormError } from './FormError';
import { Skeleton } from './Skeleton';
import { Text } from './Text';

interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * Loading skeleton, error with retry, or the content. `empty` renders the empty state so every list says what to do
 * next instead of showing nothing: when the data is a list with nothing in it, or when `isEmpty` says so. A plain
 * line of text shows as a quiet note (the console's lists); screens pass <EmptyState> for the full picture.
 */
export function QueryState<T>({
  query,
  children,
  isEmpty,
  empty,
  skeletonRows = 3,
}: {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  skeletonRows?: number;
}) {
  const { t } = useTranslation();
  if (query.isPending) {
    return (
      <View style={styles.stack} accessibilityLabel={t('common.loading')} accessibilityRole="progressbar">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={i} height={64} />
        ))}
      </View>
    );
  }
  if (query.data === undefined) {
    return (
      <View style={styles.stack}>
        <FormError error={query.error} testID="load-error" />
        <Button label={t('common.retry')} variant="secondary" size="md" onPress={() => void query.refetch()} />
      </View>
    );
  }
  // A failed background refresh keeps what is on screen and says why above it.
  const stale = query.isError ? <FormError error={query.error} testID="refresh-error" /> : null;
  const none = isEmpty ? isEmpty(query.data) : Array.isArray(query.data) && query.data.length === 0;
  if (none && empty)
    return (
      <>
        {stale}
        {typeof empty === 'string' ? (
          <Text color="textSecondary" testID="empty-note">
            {empty}
          </Text>
        ) : (
          empty
        )}
      </>
    );
  return (
    <>
      {stale}
      {children(query.data)}
    </>
  );
}

const styles = StyleSheet.create({ stack: { gap: spacing.md } });
