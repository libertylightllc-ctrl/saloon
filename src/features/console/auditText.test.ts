/** Console → Changes in sentences (final brief E2), with the live log's own entries among the examples. */
import { formatBusinessDate } from '@/lib/dates';
import { i18n, initI18n } from '@/lib/i18n';
import arabic from '@/locales/ar.json';

import type { AuditRow } from './api';
import { auditSentence } from './auditText';

const row = (action: string, before: AuditRow['before'], after: AuditRow['after'], extra: Partial<AuditRow> = {}): AuditRow => ({
  id: action,
  actor: 'owner@saloqo.test',
  action,
  salon: null,
  subject: null,
  before,
  after,
  created_at: '2026-10-28T10:00:00Z',
  ...extra,
});
const say = (r: AuditRow, lng = 'en') =>
  auditSentence(r, i18n.getFixedT(lng) as (key: string, values?: Record<string, unknown>) => string, (d, p) => formatBusinessDate(d, p, lng));

const settings = { billing_enabled: false, pilot_free_days: 90, pilot_max_salons: 20, public_free_days: 30 };

beforeAll(async () => {
  await initI18n('en');
  if (!i18n.hasResourceBundle('ar', 'translation')) i18n.addResourceBundle('ar', 'translation', arabic);
});

it('settings: only what changed, by the names Console → Settings uses', () => {
  expect(say(row('settings', settings, { ...settings, pilot_max_salons: 15 }))).toBe('Pilot places: 20 → 15');
  expect(say(row('settings', { ...settings, billing_enabled: true }, { ...settings, public_free_days: 14 }))).toBe(
    'Billing: on → off · Free days for a new salon: 30 → 14',
  );
  expect(say(row('settings', settings, settings))).toBe('Settings saved, nothing changed');
  expect(say(row('settings:contact', { whatsapp_number: null, whatsapp_message: 'Hi' }, { whatsapp_number: '+971501234567', whatsapp_message: 'Hello' }))).toBe(
    'WhatsApp number: — → +971501234567 · WhatsApp message changed',
  );
});

it('a corrected free period names the salon, both dates and its length', () => {
  const r = row('free_period:record', { note: '7-day free trial', until: '2026-11-01' }, { note: '30-day free period', until: '2026-11-24' }, { salon: 'Nebriix', actor: null });
  expect(say(r)).toBe('Nebriix: free period changed from 1 Nov to 24 Nov 2026 (30-day free period)');
  expect(say({ ...r, after: { note: '30-day free period', until: '2027-01-05' } })).toBe(
    'Nebriix: free period changed from 1 Nov 2026 to 5 Jan 2027 (30-day free period)',
  );
});

it('a salon’s access, the pilot codes and applications', () => {
  const access = (action: string, after: Record<string, unknown>, before: Record<string, unknown> = { access_type: 'trial', free_until: '2026-11-24', admin_note: null }) =>
    say(row(`access:${action}`, before, { access_type: 'trial', admin_note: null, ...after }, { salon: 'Asil Trims' }));
  expect(access('pilot', { access_type: 'pilot', free_until: '2027-01-29' })).toBe('Asil Trims: pilot salon, free until 29 Jan 2027');
  expect(access('extend', { free_until: '2026-12-24' })).toBe('Asil Trims: free time extended to 24 Dec 2026');
  expect(access('set_end', { free_until: '2026-12-01' })).toBe('Asil Trims: free until 1 Dec 2026 (was 24 Nov 2026)');
  expect(access('set_end', { free_until: '2026-12-01' }, { access_type: 'trial', free_until: null, admin_note: null })).toBe('Asil Trims: free until 1 Dec 2026');
  expect(access('end_now', { free_until: '2026-10-27' })).toBe('Asil Trims: free time ended');
  expect(access('comp', { access_type: 'comp' })).toBe('Asil Trims: free for good');
  expect(access('note', { admin_note: 'Paid cash at the shop' })).toBe('Asil Trims: note “Paid cash at the shop”');
  expect(access('note', { admin_note: null })).toBe('Asil Trims: note removed');

  expect(say(row('pilot_code:create', null, { days: 90, max_uses: 1, expires_on: '2026-11-30' }, { subject: 'RED-ROSE' }))).toBe(
    'Pilot code RED-ROSE made: 90-day free period, for 1 salon, valid until 30 Nov 2026',
  );
  expect(say(row('pilot_code:create', null, { days: 90, max_uses: 5, expires_on: null }, { subject: 'DXB5' }))).toBe('Pilot code DXB5 made: 90-day free period, for 5 salons');
  expect(say(row('pilot_code:disable', null, null, { subject: 'DXB5' }))).toBe('Pilot code DXB5 switched off');
  expect(say(row('pilot_application:approve', { status: 'new' }, { status: 'approved', code: 'K7Q2' }, { subject: 'Fade Lab' }))).toBe(
    'Fade Lab: pilot application approved, code K7Q2',
  );
  expect(say(row('pilot_application:decline', { status: 'new' }, { status: 'declined', code: null }, { subject: 'Demo pilot' }))).toBe('Demo pilot: pilot application declined');
});

it('a salon marked as a test salon, and back (final brief E1)', () => {
  expect(say(row('salon:test', { test: false }, { test: true }, { salon: 'Red Rose' }))).toBe('Red Rose: marked as a test salon');
  expect(say(row('salon:test', { test: true }, { test: false }, { salon: 'Red Rose' }))).toBe('Red Rose: no longer a test salon');
});

it('a kind of change it does not know keeps the old form rather than hiding it', () => {
  expect(say(row('something:new', { a: 1 }, { a: 2 }, { salon: 'X' }))).toBe('something:new · X · a: 1 → a: 2');
});

it('in Arabic, with its own number forms', () => {
  expect(say(row('settings', settings, { ...settings, pilot_max_salons: 15 }), 'ar')).toMatch(/^\u2068?أماكن البرنامج التجريبي\u2069?: \u2068?20\u2069? ← \u2068?15\u2069?$/);
  const free = (days: number) => say(row('free_period:record', { note: '7-day free trial', until: '2026-11-01' }, { note: `${days}-day free period`, until: '2026-11-24' }, { salon: 'Nebriix' }), 'ar');
  expect(free(30)).toContain('فترة مجانية مدتها');
  expect(free(30)).toMatch(/30\u2069? يومًا\u2069?\)$/);
  expect(free(7)).toMatch(/7\u2069? أيام\u2069?\)$/);
});
