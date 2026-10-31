/**
 * The 1200 × 630 picture of a booking link's preview (owner's fix list D1): the salon's logo on a Saloqo card, with its
 * name, its town and "Book online · no app needed", in the homepage's colours. Drawn by api/booking-card.ts.
 */
import { brandPalette } from '../../src/theme/tokens';

export interface CardNode {
  type: string;
  props: { style?: Record<string, string | number>; src?: string; width?: number; height?: number; children?: CardNode | CardNode[] | string };
}

const { ink, violet, teal, card: tile, onNavy, onNavyMuted } = brandPalette;

const node = (type: string, style: CardNode['props']['style'], children?: CardNode['props']['children']): CardNode => ({
  type,
  props: { style, ...(children === undefined ? {} : { children }) },
});

/**
 * Text the card can draw: Latin letters, digits and common marks. The card's fonts cannot join Arabic letters or
 * Devanagari, so such a name is left off the picture (the preview's title still carries it).
 */
export function drawable(text: string | null | undefined): string | null {
  const value = (text ?? '').trim();
  if (!value) return null;
  return /^[\p{Script=Latin}\p{Script=Common}\p{Mn}]+$/u.test(value) && /\p{Script=Latin}|\d/u.test(value) ? value : null;
}

export function cardTree(card: { logo: string; name: string | null; place: string | null; action: string; site: string }): CardNode {
  const name = drawable(card.name);
  const place = drawable(card.place);
  const nameSize = name && name.length > 22 ? 52 : 64;
  return node(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      padding: '0 80px',
      gap: '64px',
      backgroundColor: ink,
      backgroundImage: `radial-gradient(circle at 85% 110%, ${violet} 0%, ${violet}00 55%)`,
      fontFamily: 'Poppins',
      color: onNavy,
    },
    [
      node(
        'div',
        { width: '360px', height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: tile, borderRadius: '48px', flexShrink: 0 },
        [{ type: 'img', props: { src: card.logo, width: 280, height: 280, style: { objectFit: 'contain', width: '280px', height: '280px' } } }],
      ),
      // The column's real width (1200 − 2 × 80 − 360 − 64), so a long name wraps, at most to two lines.
      node('div', { display: 'flex', flexDirection: 'column', width: '616px', gap: '20px' }, [
        ...(name ? [node('div', { fontSize: nameSize, fontWeight: 600, lineHeight: 1.15, display: 'block', lineClamp: 2 }, name)] : []),
        ...(place ? [node('div', { fontSize: 34, color: onNavyMuted, display: 'flex' }, place)] : []),
        node('div', { display: 'flex', marginTop: '16px' }, [
          node('div', { fontSize: 30, fontWeight: 500, backgroundColor: violet, borderRadius: '999px', padding: '14px 32px', display: 'flex' }, card.action),
        ]),
        node('div', { fontSize: 26, color: teal, marginTop: '28px', display: 'flex' }, card.site),
      ]),
    ],
  );
}
