import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { gents } from './gents';
import { ladies } from './ladies';
import type { Mode, Theme } from './tokens';

export const themes: Record<Mode, Theme> = { gents, ladies };

/** Used before a salon type is chosen (the welcome screen). */
export const DEFAULT_MODE: Mode = 'gents';

interface ThemeContextValue {
  theme: Theme;
  mode: Mode;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * The look follows the signed-in branch's mode; before sign-in it follows the salon type chosen
 * on this device. The caller decides which — this just applies it.
 */
export function ThemeProvider({ mode, children }: { mode: Mode; children: ReactNode }) {
  const value = useMemo(() => ({ theme: themes[mode], mode }), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}

export function useTheme(): Theme {
  return useThemeContext().theme;
}

export function useThemeMode(): { mode: Mode } {
  return { mode: useThemeContext().mode };
}
