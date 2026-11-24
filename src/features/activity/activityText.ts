/**
 * Activity sentences in the reader's language (owner's app check E3). The server keeps one English sentence per event
 * (audit_log.summary); this finds which sentence it is (rules.ts), takes out its values (names, amounts, dates) and
 * puts them into the same sentence in the app's language. A sentence no rule knows is shown as written.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import en from '@/locales/en.json';
import { formatDuration } from '@/lib/duration';
import { useDates } from '@/lib/useDates';

import { ACTIVITY_RULES, VALUE_TYPES, type ActivityRule, type ValueType } from './rules';

interface Slot {
  name: string;
  type?: ValueType;
}
interface Compiled {
  rule: ActivityRule;
  re: RegExp;
  slots: Slot[];
}
export interface ActivityMatch {
  rule: ActivityRule;
  values: Record<string, string>;
  /** The optional parts that are in the sentence. */
  parts: string[];
}

const TOKEN = /\{(\w+)(?::(\w+))?(\?)?\}/g;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compilePiece(rule: ActivityRule, text: string, slots: Slot[], inPart: boolean): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const [whole, name, type, optional] = m as unknown as [string, string, string | undefined, string | undefined];
    out += escape(text.slice(last, m.index));
    if (optional) {
      const inner = rule.parts?.[name];
      if (inner === undefined || inPart) throw new Error(`activity rule ${rule.key}: part {${name}?}`);
      out += `(?<p_${name}>${compilePiece(rule, inner, slots, true)})?`;
    } else {
      if (type !== undefined && !(type in VALUE_TYPES)) throw new Error(`activity rule ${rule.key}: type ${type}`);
      slots.push({ name, type: type as ValueType | undefined });
      out += `(?<v_${name}>${type ? VALUE_TYPES[type as ValueType] : '.+?'})`;
    }
    last = m.index + whole.length;
  }
  return out + escape(text.slice(last));
}

let compiled: Compiled[] | null = null;
function rules(): Compiled[] {
  compiled ??= ACTIVITY_RULES.map((rule) => {
    const slots: Slot[] = [];
    const re = new RegExp(`^${compilePiece(rule, rule.en, slots, false)}$`, 's');
    return { rule, re, slots };
  });
  return compiled;
}

/** Which activity sentence this is, with its values; null if no rule knows it. */
export function matchActivity(summary: string): ActivityMatch | null {
  for (const { rule, re, slots } of rules()) {
    const m = re.exec(summary);
    if (!m) continue;
    // A sentence with no values has no groups.
    const groups = m.groups ?? {};
    const values: Record<string, string> = {};
    for (const s of slots) {
      const v = groups[`v_${s.name}`];
      if (v !== undefined) values[s.name] = v;
    }
    const parts = Object.keys(rule.parts ?? {}).filter((p) => groups[`p_${p}`] !== undefined);
    return { rule, values, parts };
  }
  return null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// The compliance record names the server writes (doc_label), back to their type, to show them translated.
const DOC_BY_LABEL = new Map(Object.entries(en.compliance.types).map(([type, label]) => [label, type]));

/** "05 Oct" (or "5 Oct", with a year: "05 Oct 2026") as an ISO date; the year only matters for the month name. */
function isoOf(dayMon: string): string | null {
  const m = /^(\d{1,2}) ([A-Z][a-z]{2})(?: (\d{4}))?$/.exec(dayMon);
  const month = m ? MONTHS.indexOf(m[2]!) : -1;
  if (!m || month < 0) return null;
  return `${m[3] ?? '2000'}-${String(month + 1).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}

type Day = (date: string, pattern: string) => string;

function show(type: ValueType | undefined, v: string, t: TFunction, day: Day): string {
  switch (type) {
    case 'guest':
      return v === 'guest' ? t('activity.values.guest') : v === 'the customer' ? t('activity.values.theCustomer') : v;
    case 'method':
      return t(`activity.values.${v as 'cash' | 'bank' | 'card'}`);
    case 'role':
      return t(`roles.${v as 'owner'}`);
    case 'kind':
      return t(`payroll.kinds.${v.toLowerCase() as 'bonus'}`);
    case 'mode':
      return t(`auth.salonType.${v as 'gents'}`);
    case 'doc': {
      const type = v in en.compliance.types ? v : DOC_BY_LABEL.get(v);
      return type ? t(`compliance.types.${type as 'visa'}`) : v;
    }
    case 'dayMon': {
      const iso = isoOf(v);
      return iso ? day(iso, 'd MMM') : v;
    }
    case 'dayMonYear': {
      const iso = isoOf(v);
      return iso ? day(iso, 'd MMM yyyy') : v;
    }
    case 'isoDate':
      return day(v, 'd MMM yyyy');
    case 'period':
      return day(`${v}-01`, 'MMMM yyyy');
    case 'minutes':
      return formatDuration(t, Number(v));
    case 'channel':
      return v === 'WhatsApp' ? v : t('activity.values.email');
    case 'ending':
      return t(v === 'pilot' ? 'activity.values.pilot' : 'activity.values.freePeriod');
    default:
      return v;
  }
}

/** The sentence in the app's language; as written if no rule knows it. */
export function translateActivity(summary: string, t: TFunction, day: Day): string {
  const match = matchActivity(summary);
  if (!match) return summary;
  const { rule, values, parts } = match;
  const slots = rules().find((c) => c.rule === rule)!.slots;
  const shown: Record<string, string | number> = {};
  for (const s of slots) {
    const v = values[s.name];
    if (v === undefined) continue;
    shown[s.name] = s.type === 'count' ? Number(v) : show(s.type, v, t, day);
  }
  for (const p of Object.keys(rule.parts ?? {})) {
    shown[p] = parts.includes(p) ? (t(`activity.${rule.key}.${p}` as 'activity.clockIn.by', shown) as string) : '';
  }
  return t(`activity.${rule.key}.text` as 'activity.clockIn.text', shown) as string;
}

/** `text(summary)`: an activity sentence in the app's language. */
export function useActivityText() {
  const { t } = useTranslation();
  const dates = useDates();
  return useCallback((summary: string) => translateActivity(summary, t, dates.day), [t, dates]);
}
