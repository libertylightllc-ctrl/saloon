import type { TFunction } from 'i18next';

import type { StatusPillProps } from '@/ui/StatusPill';

import type { ItemUnit, Movement } from './api';

const UNITS = ['ml', 'g', 'pcs', 'pairs'] as const;

/** "8 pc", "250 ml" — at most three decimals, no trailing zeros, digits always Latin. */
export function qtyText(qty: number, unit: ItemUnit | string, t: TFunction): string {
  const n = Number(qty.toFixed(3));
  const label = (UNITS as readonly string[]).includes(unit) ? t(`units.${unit as (typeof UNITS)[number]}`) : unit;
  return `${n} ${label}`;
}

/**
 * The pill on an item flagged low (owner's app check A6): below zero, stock was used that was never entered, so it
 * needs a stock count; 0 is out of stock; above 0 it is low (at or below its reorder level).
 */
export function stockPill(item: { qty: number }, t: TFunction): StatusPillProps {
  if (item.qty < 0) return { status: 'out_of_stock', label: t('inventory.countNeeded') };
  return { status: item.qty <= 0 ? 'out_of_stock' : 'low' };
}

export const MOVEMENT_REASONS: readonly Movement['reason'][] = [
  'purchase', 'service_use', 'retail_sale', 'adjustment', 'count', 'reversal', 'opening',
];
