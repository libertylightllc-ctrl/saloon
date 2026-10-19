/**
 * The tax part of a form (setup, branch settings): its fields and checks, the values a branch starts it from, and
 * what is sent to the server. A second tax beside the first (Canada's PST, RST or QST next to the GST) and the
 * province picked are part of it.
 */
import { useWatch, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import type { Branch } from '@/features/auth/session';
import { taxDisplayName } from '@/lib/i18n';
import { formatBps, parseTaxRate } from '@/lib/money';

export const taxShape = {
  tax_name: z.string().trim().min(1, 'validation.required').max(20, 'validation.tooLong'),
  tax_rate: z
    .string()
    .trim()
    .refine((v) => parseTaxRate(v) !== null, 'validation.taxRate'),
  tax_inclusive: z.boolean(),
  tax_id_label: z.string().trim().min(1, 'validation.required').max(20, 'validation.tooLong'),
  trn: z.string().trim(),
  tax2_on: z.boolean(),
  tax2_name: z.string().trim().max(20, 'validation.tooLong'),
  tax2_rate: z.string().trim(),
  tax_region: z.string(),
};

export interface TaxValues {
  tax_name: string;
  tax_rate: string;
  tax_inclusive: boolean;
  tax_id_label: string;
  trn: string;
  tax2_on: boolean;
  tax2_name: string;
  tax2_rate: string;
  tax_region: string;
}

/** A second tax, when switched on, needs its name and a rate above 0. Add to the form's schema with `.superRefine`. */
export function checkSecondTax(v: Pick<TaxValues, 'tax2_on' | 'tax2_name' | 'tax2_rate'>, ctx: z.RefinementCtx) {
  if (!v.tax2_on) return;
  if (!v.tax2_name.trim()) ctx.addIssue({ code: 'custom', path: ['tax2_name'], message: 'validation.required' });
  if (!((parseTaxRate(v.tax2_rate) ?? 0) > 0)) ctx.addIssue({ code: 'custom', path: ['tax2_rate'], message: 'validation.taxRate' });
}

/** A Canadian salon charging tax picks its province (its tax depends on it). */
export function checkProvince(v: Pick<TaxValues, 'tax_region'>, country: string, ctx: z.RefinementCtx) {
  if (country === 'CA' && !v.tax_region) ctx.addIssue({ code: 'custom', path: ['tax_region'], message: 'validation.province' });
}

/** The UAE TRN is 15 digits; elsewhere any tax number, or none yet (the server checks the same). */
export function trnValid(trn: string, uae: boolean): boolean {
  return uae ? /^[0-9]{15}$/.test(trn) : trn === '' || /^[A-Za-z0-9][A-Za-z0-9 ./-]{1,28}[A-Za-z0-9]$/.test(trn);
}

/** 887.5 → "8.875" for a rate field. */
export const rateText = (bps: number) => formatBps(bps).replace('%', '');

/** The form's tax values from a saved branch. */
export function taxValuesOf(branch: Branch): TaxValues {
  const region = (branch.settings as Record<string, unknown>).tax_region;
  return {
    tax_name: branch.tax_name,
    tax_rate: rateText(branch.tax_rate_bps),
    tax_inclusive: branch.tax_inclusive,
    tax_id_label: branch.tax_id_label,
    trn: branch.trn ?? '',
    tax2_on: branch.tax2_rate_bps > 0,
    tax2_name: branch.tax2_name ?? '',
    tax2_rate: branch.tax2_rate_bps > 0 ? rateText(branch.tax2_rate_bps) : '',
    tax_region: typeof region === 'string' ? region : '',
  };
}

/** What the server is sent for the second tax (rate 0 removes it). The province goes in the branch's settings. */
export function secondTaxPayload(v: Pick<TaxValues, 'tax2_on' | 'tax2_name' | 'tax2_rate'>) {
  const rate = v.tax2_on ? (parseTaxRate(v.tax2_rate) ?? 0) : 0;
  return { tax2_name: rate > 0 ? v.tax2_name.trim() : '', tax2_rate_bps: rate };
}

/** What the tax words read while the owner is typing them (the branch's own words apply once saved). */
export function useTaxWords<T extends FieldValues & TaxValues>(control: Control<T>) {
  const { t } = useTranslation();
  const [name, rateText_, idLabel, on2, name2, rate2Text] = useWatch({
    control,
    name: ['tax_name', 'tax_rate', 'tax_id_label', 'tax2_on', 'tax2_name', 'tax2_rate'] as FieldPath<T>[],
  }) as unknown as [string, string, string, boolean, string, string];
  const rate = parseTaxRate(rateText_ ?? '');
  const rate2 = on2 ? parseTaxRate(rate2Text ?? '') : null;
  return {
    tax: name?.trim() ? taxDisplayName(name.trim()) : t('tax.kinds.vat'),
    taxId: idLabel?.trim() && idLabel.trim() !== 'TRN' ? idLabel.trim() : t('tax.trn'),
    rate: rate === null ? '–' : formatBps(rate),
    rateBps: rate,
    /** The second tax as typed so far, when it is on and has a rate. */
    second: rate2 && rate2 > 0 ? { tax: name2?.trim() ? taxDisplayName(name2.trim()) : '–', rate: formatBps(rate2), rateBps: rate2 } : null,
  };
}
