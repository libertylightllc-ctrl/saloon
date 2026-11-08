/** Lists longer than the API's 1,000 rows a request are read whole (the console's salons, 8 Nov 2026: 1,153 locally). */
import { allPages, PAGE } from './allPages';

it('reads page after page until a short one, asking for each range in turn', async () => {
  const total = 2 * PAGE + 153;
  const asked: [number, number][] = [];
  const rows = await allPages(async (from, to) => {
    asked.push([from, to]);
    return { data: Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i), error: null };
  });
  expect(rows).toHaveLength(total);
  expect(rows[total - 1]).toBe(total - 1);
  expect(asked).toEqual([
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

it('a list that fits in one page takes one request; an error stops it', async () => {
  const one = jest.fn(async () => ({ data: [1, 2, 3], error: null }));
  await expect(allPages(one)).resolves.toEqual([1, 2, 3]);
  expect(one).toHaveBeenCalledTimes(1);
  const failing = { message: 'canceling statement due to statement timeout' };
  await expect(allPages(async () => ({ data: null, error: failing }))).rejects.toBe(failing);
});
