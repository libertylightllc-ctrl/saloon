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
  /** The screen shown: going to another one after a crash starts clear. */
  screen: string;
  onError: (error: Error) => void;
  fallback: (retry: () => void) => ReactNode;
}

interface BoundaryState {
  failed: boolean;
  /** The screen that crashed. */
  at: string | null;
}

/**
 * Never keyed by the screen: a key would rebuild the whole navigator on every move (it did, 25 Nov 2026: the site's
 * address opened on sign-in in place of the home page). After a crash, moving to another screen clears it.
 */
class Boundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false, at: null };

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    if (!state.failed) return null;
    if (state.at === null) return { at: props.screen };
    return state.at === props.screen ? null : { failed: false, at: null };
  }

  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  override render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false, at: null })) : this.props.children;
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
      screen={screen}
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
