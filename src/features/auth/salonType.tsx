import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Mode } from '@/theme';

const KEY = 'device.salonType';

interface SalonTypeValue {
  /** null until chosen on the welcome screen. */
  salonType: Mode | null;
  loaded: boolean;
  setSalonType: (type: Mode) => void;
}

const SalonTypeContext = createContext<SalonTypeValue | null>(null);

/** The salon type chosen on this device before anyone signs in. Remembered across launches. */
export function SalonTypeProvider({ children }: { children: ReactNode }) {
  const [salonType, setType] = useState<Mode | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((value) => {
        if (value === 'gents' || value === 'ladies') setType(value);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  const setSalonType = useCallback((type: Mode) => {
    setType(type);
    AsyncStorage.setItem(KEY, type).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ salonType, loaded, setSalonType }), [salonType, loaded, setSalonType]);
  return <SalonTypeContext.Provider value={value}>{children}</SalonTypeContext.Provider>;
}

export function useSalonType(): SalonTypeValue {
  const value = useContext(SalonTypeContext);
  if (!value) throw new Error('useSalonType must be used inside <SalonTypeProvider>');
  return value;
}
