import { createContext, useContext } from 'react';

/** True inside the gents violet band: content there uses white text and white tabs. */
export const OnBandContext = createContext(false);

export function useOnBand(): boolean {
  return useContext(OnBandContext);
}

/** How far the screen body is pulled up over the band (Home's hero card). Set by <Screen>. */
export const HeaderOverlapContext = createContext(0);

export function useHeaderOverlap(): number {
  return useContext(HeaderOverlapContext);
}
