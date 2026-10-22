/** Renders UI inside the app's providers (i18n, theme, direction, toasts) for tests. */
import { cleanup, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Animated } from 'react-native';
import { I18nextProvider } from 'react-i18next';

import { i18n, initI18n } from '@/lib/i18n';
import { DirectionProvider, ThemeProvider, type Mode } from '@/theme';

import { ToastProvider } from './Toast';

export async function renderInApp(ui: ReactElement, { mode = 'gents' }: { mode?: Mode } = {}) {
  await initI18n('en');
  function Providers({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <ThemeProvider mode={mode}>
          <DirectionProvider>
            <ToastProvider>{children}</ToastProvider>
          </DirectionProvider>
        </ThemeProvider>
      </I18nextProvider>
    );
  }
  return render(ui, { wrapper: Providers });
}

/**
 * The first render and the first animation in a test file load React Native's modules for the test renderer: about
 * 4 s from a cold cache, more on a busy machine, which pushed a file's first test past Jest's 5 s (22 Oct 2026). Done
 * once before the file's tests, as setup, so each test's time is its own.
 */
export function warmUpRendering() {
  beforeAll(async () => {
    await renderInApp(<></>);
    cleanup();
    Animated.timing(new Animated.Value(0), { toValue: 1, duration: 0, useNativeDriver: true }).start();
  }, 60_000);
}
