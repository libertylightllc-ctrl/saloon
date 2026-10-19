/**
 * The paper receipts print on (owner, 2026-10-19: "A4 printers are too big for salons; they use compact receipt
 * printers"): an 80 mm or 58 mm thermal roll, or A4. On a roll the receipt is laid out at the roll's printable width
 * in black only (thermal printers print no grey) with no page margin; phones make a PDF page the roll's width, long
 * enough for this receipt. Default: the 80 mm roll most salons use.
 */
export const RECEIPT_PAPERS = ['80mm', '58mm', 'a4'] as const;
export type ReceiptPaper = (typeof RECEIPT_PAPERS)[number];

/** The branch's paper, from its settings. */
export function paperOf(settings: unknown): ReceiptPaper {
  const value = (settings as Record<string, unknown> | null)?.receipt_paper;
  return RECEIPT_PAPERS.find((p) => p === value) ?? '80mm';
}

/** Printable width (the roll less the printer's edges), text and title size. */
const ROLL = {
  '80mm': { roll: 80, width: 72, font: 12, title: 16 },
  '58mm': { roll: 58, width: 48, font: 11, title: 14 },
} as const;

/** What a roll receipt adds to the receipt's styles; '' on A4. `ink`: the theme's print ink (black). */
export function paperCss(paper: ReceiptPaper, ink: string): string {
  if (paper === 'a4') return '';
  const r = ROLL[paper];
  return `@page { margin: 0; }
  body { width: ${r.width}mm; margin: 0 auto; padding: 3mm 0 6mm; font-size: ${r.font}px; color: ${ink}; }
  h1 { font-size: ${r.title}px; } header, .thanks { text-align: center; } .muted { color: ${ink}; }
  td { border-bottom: 1px dashed ${ink}; } tr.strong td { font-size: ${r.font + 3}px; }
  .logo { max-width: 70%; max-height: 64px; filter: grayscale(1) contrast(1.4); }
  .qr { width: ${Math.round(r.width * 0.55)}mm; }`;
}

const POINTS_PER_MM = 72 / 25.4;

/**
 * The PDF page for a roll on phones, in points: the roll's width, and a length for this receipt (header, each table
 * row, logo, QR code, thanks) so the printer feeds no long blank tail. Null on A4 (the usual page).
 */
export function rollPage(paper: ReceiptPaper, parts: { rows: number; logo: boolean; qr: boolean }): { width: number; height: number } | null {
  if (paper === 'a4') return null;
  const r = ROLL[paper];
  const mm = 40 + parts.rows * (r.font * 0.55) + (parts.logo ? 22 : 0) + (parts.qr ? r.width * 0.55 + 8 : 0) + 14;
  return { width: Math.round(r.roll * POINTS_PER_MM), height: Math.round(mm * POINTS_PER_MM) };
}
