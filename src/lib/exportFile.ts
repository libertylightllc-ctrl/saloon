/**
 * Getting a file out of the app: PDF (print or share), CSV and ZIP (share sheet on phones, a download on web).
 * CSV starts with a byte-order mark so Excel opens Arabic, Hindi and Urdu text correctly.
 */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { strToU8, zipSync } from 'fflate';
import { Platform } from 'react-native';

import { toCsv, type CsvCell } from './csv';

export { escapeHtml, fileSlug, toCsv, type CsvCell } from './csv';

function downloadOnWeb(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function shareFile(name: string, data: string | Uint8Array, mimeType: string, dialogTitle: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(data);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

export async function shareCsv(name: string, rows: readonly (readonly CsvCell[])[], dialogTitle: string): Promise<void> {
  const csv = toCsv(rows);
  if (Platform.OS === 'web') downloadOnWeb(`${name}.csv`, csv, 'text/csv;charset=utf-8');
  else await shareFile(`${name}.csv`, csv, 'text/csv', dialogTitle);
}

/** Several CSV files in one ZIP (the backup). */
export async function shareZip(name: string, files: Record<string, readonly (readonly CsvCell[])[]>, dialogTitle: string) {
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([file, rows]) => [`${file}.csv`, strToU8(toCsv(rows))])));
  if (Platform.OS === 'web') downloadOnWeb(`${name}.zip`, zip as Uint8Array<ArrayBuffer>, 'application/zip');
  else await shareFile(`${name}.zip`, zip, 'application/zip', dialogTitle);
}

/**
 * Web: prints `html` (a whole document) on its own. expo-print would print the whole page, and a hidden frame printed
 * with frame.print() works on computers but iPhones print the app page behind it instead (owner, 2026-10-19: a receipt
 * printed as the Quick sale screen). So the document goes into the page itself, in a shadow root of its own (its styles
 * stay inside), and a print-only style hides everything else. It stays, off screen, until the next printout.
 */
function printOnWeb(html: string) {
  document.querySelector('[data-printout]')?.remove();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  // The document's page rules (html, body) apply to the printout's own box.
  const css = [...parsed.querySelectorAll('style')]
    .map((s) => s.textContent ?? '')
    .join('\n')
    .replace(/(^|[\s,}])(html|body)(?=\s*[{,:.[#])/g, '$1.printout');
  const host = document.createElement('div');
  host.setAttribute('data-printout', 'true');
  host.setAttribute('aria-hidden', 'true');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${css}</style><div class="printout" dir="${parsed.documentElement.dir === 'rtl' ? 'rtl' : 'ltr'}">${parsed.body.innerHTML}</div>`;
  document.body.appendChild(host);
  if (!document.getElementById('printout-style')) {
    const style = document.createElement('style');
    style.id = 'printout-style';
    style.textContent = `[data-printout] { position: fixed; left: -10000px; top: 0; width: 720px; pointer-events: none; }
@media print {
  body > *:not([data-printout]) { display: none !important; }
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  [data-printout] { position: static !important; left: auto !important; width: auto !important; }
}`;
    document.head.appendChild(style);
  }
  window.print();
}

/** Share as PDF (phones) or print (web). */
export async function sharePdf(html: string, dialogTitle: string): Promise<void> {
  if (Platform.OS === 'web') {
    printOnWeb(html);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  } else {
    await Print.printAsync({ uri });
  }
}

/** Straight to the printer (phones); on web the same as sharePdf. */
export async function printHtml(html: string): Promise<void> {
  if (Platform.OS === 'web') printOnWeb(html);
  else await Print.printAsync({ html });
}
