import { useWindowDimensions } from 'react-native';

/**
 * Three layouts (owner's choice 2026-10-04): the phone layout as designed; tablets (≥ 768) get an icon rail and
 * two panes for the counter (Option B); computers (≥ 1200) get a sidebar with labels and a dashboard (Option A).
 */
export type LayoutSize = 'phone' | 'tablet' | 'desktop';

export const TABLET_MIN = 768;
export const DESKTOP_MIN = 1200;
/** Width of the side navigation: icon rail on tablets, sidebar with labels on computers. */
export const NAV_WIDTH: Record<LayoutSize, number> = { phone: 0, tablet: 84, desktop: 248 };
/** Lists and forms stay readable on a big screen (from the same left edge as every page); dashboards use the whole width. */
export const PAGE_MAX_WIDTH = 960;

export function layoutFor(width: number): LayoutSize {
  if (width >= DESKTOP_MIN) return 'desktop';
  if (width >= TABLET_MIN) return 'tablet';
  return 'phone';
}

export function useLayoutSize(): LayoutSize {
  return layoutFor(useWindowDimensions().width);
}

/** Tablet or computer: side navigation, page headers instead of the phone's band, two panes. */
export function useWide(): boolean {
  return useLayoutSize() !== 'phone';
}

/** Two panes side by side (list + detail, services + sale) once the page is at least this wide. */
export const TWO_PANE_MIN = 900;

/** The width beside the side navigation. */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return width - NAV_WIDTH[layoutFor(width)];
}

/** Room for two panes: most tablets in landscape and every computer (a tablet held upright gets one pane). */
export function useTwoPane(): boolean {
  return useContentWidth() >= TWO_PANE_MIN;
}
