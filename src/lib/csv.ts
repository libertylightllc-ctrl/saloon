/** CSV and file names for exports (pure; no device APIs). */
export type CsvCell = string | number | null | undefined;

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** RFC 4180: quote a cell when it holds a comma, quote or line break; double the quotes inside. */
export function toCsv(rows: readonly (readonly CsvCell[])[]): string {
  const cell = (value: CsvCell) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `\uFEFF${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}

/** A file name from a title: "Staff sales 2026-09" → "staff-sales-2026-09". Latin letters and digits only. */
export function fileSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'export'
  );
}
