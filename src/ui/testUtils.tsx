/** Renders UI inside the app's providers (i18n, theme, direction, toasts) for tests. */
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { i18n, initI18n } from '@/lib/i18n';
import { DirectionProvider, ThemeProvider, type Mode } from '@/theme';

import { ToastProvider } from './Toast';

export async function renderInApp(ui: ReactElement, { mode = 'gents' }: { mode?: Mode } = {}) {
  await initI18n('en');
  function Providers({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <ThemeProvider initialMode={mode}>
          <DirectionProvider>
            <ToastProvider>{children}</ToastProvider>
          </DirectionProvider>
        </ThemeProvider>
      </I18nextProvider>
    );
  }
  return render(ui, { wrapper: Providers });
}
