/**
 * What a receipt says about the seller besides its name and tax number (owner, 2026-10-19): the registered company
 * name when it differs from the salon's, the licence / commercial registration number, and in Saudi Arabia the QR code
 * ZATCA requires on every simplified tax invoice (src/lib/zatca.ts).
 */
import makeQr from 'qrcode-generator';

import { licenceLabelFor } from '@/lib/countries';
import type { CurrencyCode } from '@/lib/currencies';
import { decimalsOf } from '@/lib/money';
import { zatcaQrText } from '@/lib/zatca';

interface Seller {
  business: { name: string; country_code: string; currency: string };
  branch: { legal_name: string | null; licence_label: string | null; licence_number: string | null; trn: string | null };
}

export interface SellerLines {
  /** "Al Barsha Gents Salon LLC", only when it is not the salon's own name. */
  legalName: string | null;
  /** "CR no. 1010123456". */
  licence: string | null;
}

export function sellerLines({ business, branch }: Seller): SellerLines {
  const legal = branch.legal_name?.trim();
  const number = branch.licence_number?.trim();
  return {
    legalName: legal && legal !== business.name.trim() ? legal : null,
    licence: number ? `${branch.licence_label?.trim() || licenceLabelFor(business.country_code)} ${number}` : null,
  };
}

/** The ZATCA QR code for a Saudi sale with VAT (null elsewhere): its text and the code as an SVG. */
export function saudiReceiptQr(
  { business, branch }: Seller,
  sale: { vat_mode: string; created_at: string; total_minor: number; vat_minor: number },
): { text: string; svg: string } | null {
  if (business.country_code !== 'SA' || sale.vat_mode !== 'on' || !branch.trn) return null;
  const decimals = decimalsOf(business.currency as CurrencyCode);
  const amount = (minor: number) => (minor / 10 ** decimals).toFixed(decimals);
  const text = zatcaQrText({
    sellerName: sellerLines({ business, branch }).legalName ?? business.name,
    vatNumber: branch.trn,
    at: new Date(sale.created_at),
    total: amount(sale.total_minor),
    vat: amount(sale.vat_minor),
  });
  const qr = makeQr(0, 'M');
  qr.addData(text);
  qr.make();
  return { text, svg: qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true }) };
}
