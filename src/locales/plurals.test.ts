/** Counts read as people say them (owner's fix list #7 and #2): "1 customer", "1 person signs in", Arabic's own forms. */
import { i18n, initI18n } from '@/lib/i18n';

const say = async (lang: string, key: string, values: Record<string, unknown>) => {
  await initI18n(lang as 'en');
  // Keys come in as plain strings here, so the typed t() is loosened for this test.
  const t = i18n.getFixedT(lang) as unknown as (k: string, v: Record<string, unknown>) => string;
  return t(key, values);
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

it('Arabic counts use the form each number takes (owner’s fix list #10)', async () => {
  // Right-to-left text isolates each number (U+2068 … U+2069) so it reads the right way round; the words are checked here.
  const sayAr = async (key: string, values: Record<string, unknown>) =>
    (await say('ar', key, values)).replace(/[\u2066-\u2069]/g, '');
  const days = async (count: number) => sayAr('console.pilot.codeDays', { count });
  expect(await days(1)).toBe('يوم واحد');
  expect(await days(2)).toBe('يومان');
  expect(await days(5)).toBe('5 أيام');
  expect(await days(15)).toBe('15 يومًا');
  expect(await days(100)).toBe('100 يوم');
  expect(await sayAr('home.attention.lowStock', { count: 3 })).toBe('3 أصناف مخزونها منخفض');
  expect(await sayAr('home.attention.lowStock', { count: 2 })).toBe('صنفان مخزونهما منخفض');
  expect(await sayAr('plan.requested', { count: 2, date: '1 Nov' })).toMatch(
    /^طلبت شهرين في 1 Nov\./,
  );
  expect(await sayAr('plan.requested', { count: 12, date: '1 Nov' })).toMatch(/^طلبت 12 شهرًا/);
});

it('staff sales, opening stock and document expiry count one as one (owner’s app check E4)', async () => {
  expect(await say('en', 'reports.daysLate', { count: 1, late: 1 })).toBe('1 day · 1 late');
  expect(await say('en', 'reports.daysLate', { count: 22, late: 0 })).toBe('22 days · 0 late');
  expect(await say('en', 'inventory.opening.saved', { count: 1 })).toBe('Opening stock saved for 1 item');
  expect(await say('en', 'inventory.opening.saved', { count: 4 })).toBe('Opening stock saved for 4 items');
  expect(await say('en', 'compliance.expiresOn', { count: 1, date: '5 Oct 2026' })).toBe('Expires 5 Oct 2026 · 1 day');
  expect(await say('fr', 'reports.daysLate', { count: 1, late: 0 })).toBe('1 jour · 0 en retard');
  const sayAr = async (key: string, values: Record<string, unknown>) =>
    (await say('ar', key, values)).replace(/[⁦-⁩]/g, '');
  expect(await sayAr('reports.daysLate', { count: 1, late: 0 })).toBe('يوم واحد · 0 تأخير');
  expect(await sayAr('reports.daysLate', { count: 2, late: 0 })).toBe('يومان · 0 تأخير');
  expect(await sayAr('reports.daysLate', { count: 5, late: 1 })).toBe('5 أيام · 1 تأخير');
  expect(await sayAr('reports.daysLate', { count: 22, late: 1 })).toBe('22 يومًا · 1 تأخير');
  expect(await sayAr('inventory.opening.saved', { count: 2 })).toBe('حُفظ المخزون الافتتاحي لصنفين');
});
