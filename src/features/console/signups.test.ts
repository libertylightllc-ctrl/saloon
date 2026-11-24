/** B8 New sign-ups by week and country (owner's brief, Part B): the top five countries named, the rest "Other". */
import { OTHER, stackSignups } from './signups';

const weeks = ['2026-11-09', '2026-11-16', '2026-11-23'];

it('names the top five countries and puts the rest in Other, week by week', () => {
  const counts = [
    { week: '2026-11-09', country_code: 'AE', salons: 5 },
    { week: '2026-11-16', country_code: 'AE', salons: 2 },
    { week: '2026-11-16', country_code: 'SA', salons: 3 },
    { week: '2026-11-23', country_code: 'US', salons: 2 },
    { week: '2026-11-23', country_code: 'QA', salons: 1 },
    { week: '2026-11-23', country_code: 'KW', salons: 1 },
    { week: '2026-11-23', country_code: 'OM', salons: 1 },
    { week: '2026-11-23', country_code: 'BH', salons: 1 },
  ];
  const s = stackSignups({ weeks, counts });
  expect(s.series).toEqual([
    { code: 'AE', total: 7 },
    { code: 'SA', total: 3 },
    { code: 'US', total: 2 },
    { code: 'BH', total: 1 },
    { code: 'KW', total: 1 },
    { code: OTHER, total: 2 },
  ]);
  expect(s.weeks.map((w) => [w.week, w.total, w.parts])).toEqual([
    ['2026-11-09', 5, [5, 0, 0, 0, 0, 0]],
    ['2026-11-16', 5, [2, 3, 0, 0, 0, 0]],
    ['2026-11-23', 6, [0, 0, 2, 1, 1, 2]],
  ]);
  expect(s.total).toBe(16);
});

it('six countries are all named: no "Other" holding just one', () => {
  const counts = ['AE', 'SA', 'US', 'QA', 'KW', 'OM'].map((country_code) => ({ week: '2026-11-23', country_code, salons: 1 }));
  expect(stackSignups({ weeks, counts }).series.map((x) => x.code)).toEqual(['AE', 'KW', 'OM', 'QA', 'SA', 'US']);
});

it('no sign-ups: empty weeks', () => {
  const s = stackSignups({ weeks, counts: [] });
  expect(s.series).toEqual([]);
  expect(s.weeks.map((w) => w.total)).toEqual([0, 0, 0]);
});
