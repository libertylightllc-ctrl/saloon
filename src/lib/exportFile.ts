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
 * Web: expo-print ignores the HTML and prints the whole page, so the document goes into a hidden
 * frame of its own and that frame is printed. The frame stays until the next document replaces it.
 */
function printOnWeb(html: string) {
  document.querySelector('iframe[data-receipt]')?.remove();
  const frame = document.createElement('iframe');
  frame.setAttribute('data-receipt', 'true');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
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
