import type { TFunction } from 'i18next';

const UNITS = ['ml', 'g', 'pcs', 'pairs'] as const;

/** "Shaving Foam 10 ml · Blades 1 pc" with translated unit labels. */
export function recipeText(lines: readonly { name: string; qty: number; unit: string }[], t: TFunction, separator = ' · '): string {
  return lines
    .map((r) => {
      const unit = (UNITS as readonly string[]).includes(r.unit) ? t(`units.${r.unit as (typeof UNITS)[number]}`) : r.unit;
      return `${r.name} ${r.qty} ${unit}`;
    })
    .join(separator);
}
