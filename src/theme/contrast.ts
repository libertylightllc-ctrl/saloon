/** WCAG 2.x contrast maths for #RRGGBB colours. Used by Avatar and the theme contrast tests. */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new RangeError(`Expected #RRGGBB, got ${hex}`);
  const n = parseInt(match[1]!, 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The more readable of two ink colours on a background. */
export function readableOn(background: string, dark: string, light: string): string {
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}
