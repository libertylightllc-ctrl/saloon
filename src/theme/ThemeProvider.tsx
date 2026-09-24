import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { gents } from './gents';
import { ladies } from './ladies';
import type { Mode, Theme } from './tokens';

export const themes: Record<Mode, Theme> = { gents, ladies };

/** Onboarding and sign-in use gents until a mode is chosen (03-SCREENS §2.1). */
export const DEFAULT_MODE: Mode = 'gents';

interface ThemeContextValue {
  theme: Theme;
  mode: Mode;
  setMode: (mode: Mode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Until branches exist (phase 2) the mode is a developer toggle remembered on the device.
const DEV_MODE_KEY = 'dev.themeMode';

export async function loadStoredMode(): Promise<Mode> {
  try {
    const stored = await AsyncStorage.getItem(DEV_MODE_KEY);
    return stored === 'gents' || stored === 'ladies' ? stored : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function ThemeProvider({
  initialMode = DEFAULT_MODE,
  children,
}: {
  initialMode?: Mode;
  children: ReactNode;
}) {
  const [mode, setModeState] = useState<Mode>(initialMode);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: themes[mode],
      mode,
      setMode: (next) => {
        setModeState(next);
        AsyncStorage.setItem(DEV_MODE_KEY, next).catch(() => {});
      },
    }),
    [mode],
  );

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

export function useThemeMode(): { mode: Mode; setMode: (mode: Mode) => void } {
  const { mode, setMode } = useThemeContext();
  return { mode, setMode };
}
