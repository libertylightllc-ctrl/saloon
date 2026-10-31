import type { AuditRow } from './api';

type Translate = (key: string, values?: Record<string, unknown>) => string;
type Day = (date: string, pattern: string) => string;
type Values = Record<string, unknown> | null;

/** Platform settings by their name in the log, as Console → Settings calls them. */
const FIELDS = ['billing_enabled', 'public_free_days', 'pilot_free_days', 'pilot_max_salons', 'whatsapp_number', 'whatsapp_message'];
/** Too long to show both ways: only that it changed. */
const LONG = ['whatsapp_message'];

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const text = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

function value(v: unknown, t: Translate): string {
  if (typeof v === 'boolean') return t(v ? 'console.audit.on' : 'console.audit.off');
  return text(v) ?? '—';
}

/** "Pilot places: 20 → 15 · Billing: on → off", only what changed. */
function settingsLine(before: Values, after: Values, t: Translate): string {
  const keys = FIELDS.filter((k) => after && k in after && JSON.stringify(before?.[k]) !== JSON.stringify(after[k]));
  if (keys.length === 0) return t('console.audit.nothingChanged');
  return keys
    .map((k) => {
      const label = t(`console.audit.field.${k}`);
      return LONG.includes(k) ? t('console.audit.textChanged', { label }) : t('console.audit.changed', { label, before: value(before?.[k], t), after: value(after?.[k], t) });
    })
    .join(' · ');
}

/** "30-day free period" from the record's note, in the reader's language when it is one Saloqo wrote. */
function freeLength(note: unknown, t: Translate): string {
  const days = /^(\d+)-day free (period|trial)$/.exec(text(note) ?? '');
  return days ? t('console.audit.freeDays', { count: Number(days[1]) }) : (text(note) ?? '—');
}

/** The raw form, for a kind of change this console does not know yet. */
function raw(r: AuditRow, t: Translate): string {
  const show = (v: Values) => (v ? Object.entries(v).map(([k, x]) => `${k}: ${x === null ? '—' : String(x)}`).join(', ') : '—');
  return [[r.action, r.salon ?? r.subject].filter(Boolean).join(' · '), t('console.audit.change', { before: show(r.before), after: show(r.after) })].join(' · ');
}

/**
 * A change in the platform owners' log (Console → Changes) as a sentence (final brief E2): "Pilot places: 20 → 15",
 * "Nebriix: free period changed from 1 Nov to 24 Nov 2026 (30-day free period)".
 */
export function auditSentence(r: AuditRow, t: Translate, day: Day): string {
  const salon = r.salon ?? r.subject ?? '—';
  const b = r.before ?? {};
  const a = r.after ?? {};
  const long = (d: string) => day(d, 'd MMM yyyy');
  switch (r.action) {
    case 'settings':
    case 'settings:contact':
      return settingsLine(r.before, r.after, t);
    case 'free_period:record': {
      if (!isDate(b.until) || !isDate(a.until)) return raw(r, t);
      const from = b.until.slice(0, 4) === a.until.slice(0, 4) ? day(b.until, 'd MMM') : long(b.until);
      return t('console.audit.freePeriod', { salon, from, to: long(a.until), length: freeLength(a.note, t) });
    }
    case 'access:pilot':
      return isDate(a.free_until) ? t('console.audit.pilot', { salon, date: long(a.free_until) }) : raw(r, t);
    case 'access:extend':
      return isDate(a.free_until) ? t('console.audit.extend', { salon, date: long(a.free_until) }) : raw(r, t);
    case 'access:set_end':
      if (!isDate(a.free_until)) return raw(r, t);
      return isDate(b.free_until)
        ? t('console.audit.setEnd', { salon, from: long(b.free_until), to: long(a.free_until) })
        : t('console.audit.setEndNew', { salon, date: long(a.free_until) });
    case 'access:end_now':
      return t('console.audit.endNow', { salon });
    case 'access:comp':
      return t('console.audit.comp', { salon });
    case 'access:note':
      return text(a.admin_note) ? t('console.audit.note', { salon, note: text(a.admin_note) }) : t('console.audit.noteRemoved', { salon });
    case 'pilot_code:create': {
      const values = {
        code: r.subject ?? '—',
        length: t('console.audit.freeDays', { count: Number(a.days) || 0 }),
        uses: t('console.audit.uses', { count: Number(a.max_uses) || 1 }),
      };
      return isDate(a.expires_on) ? t('console.audit.codeMadeUntil', { ...values, date: long(a.expires_on) }) : t('console.audit.codeMade', values);
    }
    case 'pilot_code:disable':
      return t('console.audit.codeOff', { code: r.subject ?? '—' });
    case 'pilot_application:approve':
      return t('console.audit.approved', { salon, code: text(a.code) ?? '—' });
    case 'pilot_application:decline':
      return t('console.audit.declined', { salon });
    case 'salon:test':
      return t(a.test === true ? 'console.audit.testOn' : 'console.audit.testOff', { salon });
    default:
      return raw(r, t);
  }
}
