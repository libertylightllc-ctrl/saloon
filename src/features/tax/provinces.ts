/**
 * Canada's sales tax by province (owner, 2026-10-19: "go for both"). A salon charges either HST (one harmonised tax)
 * or GST, plus a provincial tax beside it in four provinces; never HST and GST together. Rates as at October 2026
 * (Nova Scotia's HST fell to 14% in April 2025). All are added at the till.
 */
import type { TaxRate } from '@/lib/money';

export type ProvinceCode = 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

export interface Province {
  code: ProvinceCode;
  tax: { name: string; rateBps: TaxRate };
  /** The provincial tax charged beside the GST (PST, RST, QST). */
  second?: { name: string; rateBps: TaxRate };
}

const gst = (code: ProvinceCode, second?: Province['second']): Province => ({ code, tax: { name: 'GST', rateBps: 500 }, second });
const hst = (code: ProvinceCode, rateBps: TaxRate): Province => ({ code, tax: { name: 'HST', rateBps } });

export const PROVINCES: readonly Province[] = [
  gst('AB'),
  gst('BC', { name: 'PST', rateBps: 700 }),
  gst('MB', { name: 'RST', rateBps: 700 }),
  hst('NB', 1500),
  hst('NL', 1500),
  hst('NS', 1400),
  gst('NT'),
  gst('NU'),
  hst('ON', 1300),
  hst('PE', 1500),
  gst('QC', { name: 'QST', rateBps: 997.5 }),
  gst('SK', { name: 'PST', rateBps: 600 }),
  gst('YT'),
];

export function provinceOf(code: string | null | undefined): Province | null {
  return PROVINCES.find((p) => p.code === code) ?? null;
}
