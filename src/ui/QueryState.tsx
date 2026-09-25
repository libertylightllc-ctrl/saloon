import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Button } from './Button';
import { FormError } from './FormError';
import { Skeleton } from './Skeleton';

interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * Loading skeleton, error with retry, or the content. `isEmpty` + `empty` render the empty state
 * so every list says what to do next instead of showing nothing.
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
  if (isEmpty?.(query.data) && empty)
    return (
      <>
        {stale}
        {empty}
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
