import { mergeRepeatRequests } from './planEvents';

const ev = (id: string, salon: string, kind: string, at: string, months: number | null = 1) => ({
  id,
  business_id: salon,
  kind,
  months,
  created_at: `2026-10-${at}Z`,
});
const ids = (rows: { id: string; repeats: number }[]) => rows.map((r) => `${r.id}×${r.repeats}`);

describe('Console → Plans folds a request sent again (final brief E3)', () => {
  it('two identical requests before anything is paid are one row: the latest, sent twice, first at the first', () => {
    // Newest first, as the console gets them: Asil Trims paid on 6 Oct, then asked for 1 month twice on 20 Oct.
    const rows = [ev('r2', 'asil', 'request', '20T17:33:44'), ev('r1', 'asil', 'request', '20T17:33:18'), ev('p1', 'asil', 'activate', '05T22:26:25')];
    const merged = mergeRepeatRequests(rows);
    expect(ids(merged)).toEqual(['r2×2', 'p1×1']);
    expect(merged[0]!.first_at).toBe('2026-10-20T17:33:18Z');
  });

  it('keeps requests apart when a payment or an ending came between, the months differ, or the salon differs', () => {
    const rows = [
      ev('r5', 'a', 'request', '20T10:00:00'),
      ev('e1', 'a', 'end', '19T10:00:00', null),
      ev('r4', 'a', 'request', '18T10:00:00'),
      ev('r3', 'a', 'request', '17T10:00:00', 6),
      ev('r2', 'b', 'request', '16T10:00:00'),
      ev('r1', 'a', 'request', '15T10:00:00', 6),
    ];
    expect(ids(mergeRepeatRequests(rows))).toEqual(['r5×1', 'e1×1', 'r4×1', 'r3×2', 'r2×1']);
  });

  it('a free period or access change in between does not end the wait; three sends are one row', () => {
    const rows = [ev('r3', 'a', 'request', '22T10:00:00'), ev('t1', 'a', 'access', '21T10:00:00', null), ev('r2', 'a', 'request', '20T10:00:00'), ev('r1', 'a', 'request', '19T10:00:00')];
    const merged = mergeRepeatRequests(rows);
    expect(ids(merged)).toEqual(['r3×3', 't1×1']);
    expect(merged[0]!.first_at).toBe('2026-10-19T10:00:00Z');
  });
});
