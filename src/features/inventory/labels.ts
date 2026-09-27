import type { TFunction } from 'i18next';

import type { ItemUnit, Movement } from './api';

const UNITS = ['ml', 'g', 'pcs', 'pairs'] as const;

/** "8 pc", "250 ml" — at most three decimals, no trailing zeros, digits always Latin. */
export function qtyText(qty: number, unit: ItemUnit | string, t: TFunction): string {
  const n = Number(qty.toFixed(3));
  const label = (UNITS as readonly string[]).includes(unit) ? t(`units.${unit as (typeof UNITS)[number]}`) : unit;
  return `${n} ${label}`;
}

export const MOVEMENT_REASONS: readonly Movement['reason'][] = [
  'purchase', 'service_use', 'retail_sale', 'adjustment', 'count', 'reversal', 'opening',
];
