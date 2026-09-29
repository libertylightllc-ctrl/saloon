import { escapeHtml, fileSlug, toCsv } from './csv';

describe('toCsv', () => {
  it('quotes only the cells that need it and ends every line with CRLF', () => {
    expect(toCsv([['Name', 'Note'], ['Omar', 'said "hi", then left'], ['Noor', null]])).toBe(
      '﻿Name,Note\r\nOmar,"said ""hi"", then left"\r\nNoor,\r\n',
    );
  });

  it('keeps Arabic text and numbers as they are', () => {
    expect(toCsv([['عمر', 105.5, 0]])).toBe('﻿عمر,105.5,0\r\n');
  });

  it('quotes line breaks', () => {
    expect(toCsv([['a\nb']])).toBe('﻿"a\nb"\r\n');
  });
});

describe('fileSlug', () => {
  it('makes a safe file name', () => {
    expect(fileSlug('Al Barsha Gents — Staff sales 2026-09')).toBe('al-barsha-gents-staff-sales-2026-09');
    expect(fileSlug('صالون')).toBe('export');
  });
});

describe('escapeHtml', () => {
  it('escapes markup', () => {
    expect(escapeHtml('<b>"A&B"</b>')).toBe('&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;');
  });
});
