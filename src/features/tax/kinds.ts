/**
 * The usual kinds of sales tax the owner picks from (owner, 2026-10-19: "Sales tax, GST, VAT should be selectable"):
 * stored by their English name, shown in the reader's language. Any other name is "Other" and shows as written.
 */
export const TAX_KINDS = [
  { key: 'vat', name: 'VAT' },
  { key: 'gst', name: 'GST' },
  // Canada's harmonised sales tax (Ontario, the Atlantic provinces): never charged with the GST.
  { key: 'hst', name: 'HST' },
  { key: 'salesTax', name: 'Sales tax' },
  { key: 'serviceTax', name: 'Service tax' },
] as const;

export type TaxKind = (typeof TAX_KINDS)[number]['key'];

/** Canada's provincial taxes charged beside the GST: no chips, but shown in the reader's language (QST is TVQ in French). */
const PROVINCIAL = [
  { key: 'pst', name: 'PST' },
  { key: 'qst', name: 'QST' },
  { key: 'rst', name: 'RST' },
] as const;

/** The words key of a usual tax name (a chip's or a provincial tax's), or null for the owner's own name. */
export function taxWordKey(name: string): TaxKind | (typeof PROVINCIAL)[number]['key'] | null {
  const n = name.trim().toLowerCase();
  return taxKindOf(name) ?? PROVINCIAL.find((k) => k.name.toLowerCase() === n)?.key ?? null;
}

/** Which usual kind a stored name is, or null for the owner's own name. */
export function taxKindOf(name: string | null | undefined): TaxKind | null {
  const n = (name ?? '').trim().toLowerCase();
  return TAX_KINDS.find((k) => k.name.toLowerCase() === n)?.key ?? null;
}
