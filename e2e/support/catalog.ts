import type { Mode } from './api';

/** One seeded service per mode (seed_mode_catalogue) with its recipe. */
export const SERVICE = {
  gents: { name: 'Haircut', price: 2500, product: 'Neck strips', uses: 1, staff: 'Rafiq E2E' },
  ladies: { name: 'Blow-dry', price: 8000, product: 'Heat spray', uses: 5, staff: 'Aisha E2E' },
} as const satisfies Record<Mode, { name: string; price: number; product: string; uses: number; staff: string }>;
