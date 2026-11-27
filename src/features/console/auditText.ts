import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { STAGES } from '@/features/support/stage';

import type { AuditRow } from './api';

type Translate = (key: string, values?: Record<string, unknown>) => string;
type Day = (date: string, pattern: string) => string;
type Values = Record<string, unknown> | null;

/** Platform settings by their name in the log, as Console → Settings calls them. */
const FIELDS = [
  'billing_enabled',
  'public_free_days',
  'pilot_free_days',
  'pilot_max_salons',
  'whatsapp_number',
  'whatsapp_message',
  'reporting_currency',
];
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
    case 'settings:currency':
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
    case 'salon:contact': {
      // "Palm Salon: WhatsApp message to the owner opened, the free period ends 28 Nov 2026" (owner's brief, Part B6);
      // opened, not sent: what happens in WhatsApp is not known here.
      if (!isDate(a.until) || (a.channel !== 'whatsapp' && a.channel !== 'email')) return raw(r, t);
      return t(`console.audit.contact.${a.channel}`, { salon, what: t(a.ending === 'pilot' ? 'console.audit.contact.pilot' : 'console.audit.contact.free'), date: long(a.until) });
    }
    case 'payment:mark': {
      // "Asil Trims: payment of USD 42.99 on 12 Oct 2026 marked Test: paid by us to try it" (owner's brief A4).
      const code = text(a.currency);
      const amount = typeof a.amount_minor === 'number' && code && isCurrency(code) ? formatMoney(a.amount_minor, code) : '—';
      const values = { salon, amount, date: isDate(a.paid_on) ? long(a.paid_on) : '—', reason: text(a.reason) ?? '—' };
      if (a.mark === 'test' || a.mark === 'void') return t(`console.audit.paymentMarked.${a.mark}`, values);
      return t('console.audit.paymentCounted', values);
    }
    case 'support:stage': {
      // "Support conversation with Layla, Palm Salon: Waiting for you → Solved (Answered by phone)" (owner's brief,
      // Part E1). The subject is who wrote; a visitor has no salon.
      const stage = (s: unknown) => (STAGES.includes(s as never) ? t(`console.support.stage.${String(s)}`) : '—');
      const values = {
        who: r.subject ?? t('console.support.someone'),
        where: r.salon ?? t('console.support.visitor'),
        from: stage(b.stage),
        to: stage(a.stage),
      };
      const reason = text(a.reason);
      return reason ? t('console.audit.supportStageReason', { ...values, reason }) : t('console.audit.supportStage', values);
    }
    case 'support:whatsapp':
      // "Answered Layla, Palm Salon on WhatsApp" (Part E3): kept in the conversation; WhatsApp then opened with it.
      return t('console.audit.supportWhatsApp', {
        who: r.subject ?? t('console.support.someone'),
        where: r.salon ?? t('console.support.visitor'),
      });
    case 'support:saved_reply': {
      // Saved replies added, changed (renamed: both names) or removed (Part E3).
      const title = text(a.title) ?? text(b.title) ?? r.subject ?? '—';
      if (r.before === null) return t('console.audit.savedReplyAdded', { title });
      if (a.removed === true) return t('console.audit.savedReplyRemoved', { title });
      return text(b.title) && b.title !== a.title
        ? t('console.audit.savedReplyRenamed', { from: text(b.title), title })
        : t('console.audit.savedReplyChanged', { title });
    }
    default:
      return raw(r, t);
  }
}
