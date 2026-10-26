/** Counts read as people say them (owner's fix list #7 and #2): "1 customer", "1 person signs in", Arabic's own forms. */
import { i18n, initI18n } from '@/lib/i18n';

const say = async (lang: string, key: string, values: Record<string, unknown>) => {
  await initI18n(lang as 'en');
  return i18n.getFixedT(lang)(key, values);
};

it('the console counts one of a thing as one', async () => {
  expect(await say('en', 'console.salons.customers', { count: 1 })).toBe('1 customer');
  expect(await say('en', 'console.salons.customers', { count: 2 })).toBe('2 customers');
  expect(await say('en', 'console.salons.people', { count: 1 })).toBe('1 person signs in');
  expect(await say('en', 'console.salons.people', { count: 5 })).toBe('5 people sign in');
  expect(await say('en', 'console.overview.newApplications', { count: 1 })).toBe('1 new application');
  expect(await say('en', 'console.pilot.codeDays', { count: 1 })).toBe('1 day');
});

it('a plan request names its months in words that fit the number', async () => {
  expect(await say('en', 'admin.requested', { count: 1, note: '' })).toBe('Asked for 1 month. ');
  expect(await say('en', 'admin.requested', { count: 6, note: '' })).toBe('Asked for 6 months. ');
  expect(await say('ar', 'admin.requested', { count: 1, note: '' })).toMatch(/^طلب شهرًا واحدًا\./);
  expect(await say('ar', 'admin.requested', { count: 6, note: '' })).toMatch(/أشهر/);
  expect(await say('ar', 'admin.requested', { count: 12, note: '' })).toMatch(/شهرًا/);
});
