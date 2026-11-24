import { router, usePathname } from 'expo-router';
import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/features/auth/session';
import { spacing, useTheme } from '@/theme';
import { Button, EmptyState } from '@/ui';

import { reportAppError } from './report';

interface BoundaryProps {
  children: ReactNode;
  onError: (error: Error) => void;
  fallback: (retry: () => void) => ReactNode;
}

class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  override render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}

/**
 * A screen that crashes shows "Something went wrong. Try again." with Try again and Back, instead of a blank page,
 * and the platform owners see it in System health (owner's brief, Part B, B10): the error, the screen, the salon.
 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { member } = useSession();
  const screen = usePathname();
  return (
    <Boundary
      // A new screen starts clear.
      key={screen}
      onError={(error) => reportAppError(error, screen, member?.active ? member.business_id : null)}
      fallback={(retry) => <CrashScreen onRetry={retry} />}
    >
      {children}
    </Boundary>
  );
}

function CrashScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]} testID="app-crashed">
      <EmptyState illustration="no-results" message={t('errors.unknown')} actionLabel={t('common.retry')} onAction={onRetry} />
      <Button
        variant="ghost"
        label={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        testID="app-crashed-back"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.xl },
});
