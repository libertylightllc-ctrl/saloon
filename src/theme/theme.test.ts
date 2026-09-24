import { contrastRatio } from './contrast';
import { gents } from './gents';
import { ladies } from './ladies';
import { avatarPalette, neutrals, semantic, type Theme } from './tokens';

/** Every key path in an object, so the two themes can be compared structurally. */
function shape(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
}

const themes: [string, Theme][] = [
  ['gents', gents],
  ['ladies', ladies],
];

describe('theme structure', () => {
  it('gents and ladies have exactly the same keys', () => {
    expect(shape(ladies).sort()).toEqual(shape(gents).sort());
  });

  it('differ in the signature variants from 02-DESIGN-SYSTEM §2', () => {
    expect(gents.variants.header).toBe('band');
    expect(ladies.variants.header).toBe('light');
    expect(gents.variants.segmentTabs).toBe('band');
    expect(ladies.variants.segmentTabs).toBe('pill');
    expect(gents.variants.listAction).toBe('tinted');
    expect(ladies.variants.listAction).toBe('outlined');
    expect(gents.sizes.buttonLg).toBe(52);
    expect(ladies.sizes.buttonLg).toBe(48);
    expect(gents.radius.button).toBe(12);
    expect(ladies.radius.button).toBe(10);
  });

  it('uses multicolour category circles in gents and one coral tint in ladies', () => {
    expect(gents.colors.categoryFills).toHaveLength(5);
    expect(new Set(ladies.colors.categoryFills).size).toBe(1);
  });
});

describe.each(themes)('%s contrast (4.5:1 for text)', (_name, theme) => {
  const { colors } = theme;
  const AA = 4.5;

  it('keeps body and secondary text readable on white', () => {
    expect(contrastRatio(colors.text, colors.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(colors.textSecondary, colors.surface)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps secondary text readable on the tinted backgrounds', () => {
    const backgrounds = [colors.background, ...(theme.backgroundGradient ?? [])];
    for (const bg of backgrounds) {
      expect(contrastRatio(colors.textOnTint, bg)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(colors.text, bg)).toBeGreaterThanOrEqual(AA);
    }
  });

  it('keeps coloured text readable on white and on tinted buttons', () => {
    expect(contrastRatio(colors.primaryText, colors.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(colors.primaryText, colors.primary50)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(colors.primary700, colors.primary50)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps status pills readable (surface background + pressed text)', () => {
    for (const set of Object.values(semantic)) {
      expect(contrastRatio(set.pressed, set.surface)).toBeGreaterThanOrEqual(AA);
    }
    expect(contrastRatio(neutrals.n80, neutrals.n20)).toBeGreaterThanOrEqual(AA);
  });
});

describe('filled button labels', () => {
  it('gents violet passes 4.5:1', () => {
    expect(
      contrastRatio(gents.colors.onPrimary, gents.colors.primaryAction),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('ladies coral is the documented 3:1 compromise (02-DESIGN-SYSTEM §1.2, DECISIONS.md)', () => {
    const ratio = contrastRatio(ladies.colors.onPrimary, ladies.colors.primaryAction);
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThan(4.5);
  });
});

describe('avatar palette', () => {
  it('every initials pair is readable', () => {
    for (const pair of avatarPalette) {
      expect(contrastRatio(pair.ink, pair.fill)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
