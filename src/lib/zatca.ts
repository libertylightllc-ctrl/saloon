/**
 * The QR code Saudi Arabia's tax authority (ZATCA) requires on every simplified tax invoice (shop receipt) since
 * December 2021 (owner, 2026-10-19). It holds, in this order, the seller's name, its VAT number, the time of the sale,
 * the total with VAT and the VAT, each as tag · length · UTF-8 value, all in base64; the customer scans it with the
 * VAT app. (ZATCA's second phase, reporting each invoice to it with a digital stamp, is not built.)
 */
export interface ZatcaInvoice {
  sellerName: string;
  vatNumber: string;
  /** When the sale happened. */
  at: Date;
  /** "115.00": the total with VAT, in riyals. */
  total: string;
  /** "15.00". */
  vat: string;
}

/** "2026-10-19T12:34:56Z" (UTC, whole seconds). */
function timestamp(at: Date): string {
  return at.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i]!, bytes[i + 1], bytes[i + 2]];
    out += BASE64[a >> 2]! + BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    out += b === undefined ? '=' : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    out += c === undefined ? '=' : BASE64[c & 63]!;
  }
  return out;
}

/** The text inside the QR code. */
export function zatcaQrText(inv: ZatcaInvoice): string {
  const fields = [inv.sellerName, inv.vatNumber, timestamp(inv.at), inv.total, inv.vat];
  const bytes: number[] = [];
  fields.forEach((value, i) => {
    const data = new TextEncoder().encode(value);
    if (data.length > 255) throw new Error('zatca_field_too_long');
    bytes.push(i + 1, data.length, ...data);
  });
  return base64(Uint8Array.from(bytes));
}
