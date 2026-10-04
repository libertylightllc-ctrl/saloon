import { createContext, useContext } from 'react';

/** True inside the gents violet band: content there uses white text and white tabs. */
export const OnBandContext = createContext(false);

export function useOnBand(): boolean {
  return useContext(OnBandContext);
}

/**
 * On tablets and computers: the widest the page's header and body may grow (null: the whole width beside the
 * navigation). Set by <Screen>, so its header lines up with its body; every page starts at the same left edge.
 */
export const PageWidthContext = createContext<number | null>(null);

export function usePageWidth(): number | null {
  return useContext(PageWidthContext);
}

/**
 * The pages the side navigation opens directly (tablets and computers). They are top-level there, so their header
 * shows no back arrow. Null on phones.
 */
export const NavRootsContext = createContext<ReadonlySet<string> | null>(null);

/** How far the screen body is pulled up over the band (Home's hero card). Set by <Screen>. */
export const HeaderOverlapContext = createContext(0);

export function useHeaderOverlap(): number {
  return useContext(HeaderOverlapContext);
}
