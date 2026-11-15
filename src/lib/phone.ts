/**
 * Phone numbers (owner's app check F1): one check everywhere — the country's number length, not all one digit — and
 * saved with the country code, "+974 5551 2345". A number typed the local way ("0501234567" in the UAE, "55512345"
 * in Qatar) gets the salon's country code; one typed with a code (+44…, 0044…) keeps its own. The database does the
 * same (normalize_phone, migration 106) from the same table; phone.test.ts keeps the two in step.
 */

export interface PhoneRule {
  /** The country code, digits only: "971". */
  dial: string;
  /** How long the number is after the country code (without the leading 0). */
  min: number;
  max: number;
  /** What people put in front of a local number (usually "0"). */
  trunk: string;
}

const r = (dial: string, min: number, max = min, trunk = '0'): PhoneRule => ({ dial, min, max, trunk });

/** Every country the app offers (src/lib/countries.ts). */
export const PHONE_RULES: Record<string, PhoneRule> = {
  AE: r('971', 8, 9), SA: r('966', 8, 9), QA: r('974', 8), KW: r('965', 8), BH: r('973', 8), OM: r('968', 8),
  EG: r('20', 8, 10), JO: r('962', 8, 9), MA: r('212', 9), TN: r('216', 8), TR: r('90', 10), ZA: r('27', 9),
  NG: r('234', 8, 10), KE: r('254', 9), GH: r('233', 9), IN: r('91', 10), PK: r('92', 9, 10), BD: r('880', 8, 10),
  LK: r('94', 9), NP: r('977', 8, 10), SG: r('65', 8), MY: r('60', 9, 10), PH: r('63', 8, 10), ID: r('62', 9, 12),
  TH: r('66', 8, 9), VN: r('84', 9, 10), JP: r('81', 9, 10), AU: r('61', 9), NZ: r('64', 8, 10), GB: r('44', 9, 10),
  IE: r('353', 7, 9), DE: r('49', 6, 11), FR: r('33', 9), ES: r('34', 9, 9, ''), IT: r('39', 6, 11, ''),
  NL: r('31', 9), BE: r('32', 8, 9), PT: r('351', 9, 9, ''), AT: r('43', 6, 13), GR: r('30', 10, 10, ''),
  CH: r('41', 9), SE: r('46', 7, 10), NO: r('47', 8, 8, ''), DK: r('45', 8, 8, ''), PL: r('48', 9, 9, ''),
  US: r('1', 10, 10, '1'), CA: r('1', 10, 10, '1'), MX: r('52', 10), BR: r('55', 10, 11), CO: r('57', 8, 10),
  CL: r('56', 9), FI: r('358', 6, 11), EE: r('372', 7, 8, ''), LV: r('371', 8, 8, ''), LT: r('370', 8, 8, '8'),
  LU: r('352', 6, 11, ''), MT: r('356', 8, 8, ''), CY: r('357', 8, 8, ''), SK: r('421', 9), SI: r('386', 8),
  HR: r('385', 8, 9), BG: r('359', 8, 9), CZ: r('420', 9, 9, ''), HU: r('36', 8, 9, '06'), RO: r('40', 9),
  IS: r('354', 7, 7, ''), UA: r('380', 9), RS: r('381', 8, 9), AL: r('355', 8, 9), MK: r('389', 8),
  BA: r('387', 8, 9), ME: r('382', 8), MD: r('373', 8), GE: r('995', 9), AM: r('374', 8), AZ: r('994', 9),
  KZ: r('7', 10, 10, '8'), UZ: r('998', 9, 9, ''), KG: r('996', 9), TJ: r('992', 9, 9, ''), TM: r('993', 8, 8, '8'),
  MN: r('976', 8, 8, ''), IQ: r('964', 8, 10), LB: r('961', 7, 8), IL: r('972', 8, 9), PS: r('970', 8, 9),
  DZ: r('213', 8, 9), LY: r('218', 8, 9), AR: r('54', 10, 11), PE: r('51', 8, 9), EC: r('593', 8, 9),
  UY: r('598', 8), PY: r('595', 7, 9), BO: r('591', 8, 8, ''), VE: r('58', 10), CR: r('506', 8, 8, ''),
  PA: r('507', 7, 8, ''), GT: r('502', 8, 8, ''), HN: r('504', 8, 8, ''), SV: r('503', 8, 8, ''),
  NI: r('505', 8, 8, ''), DO: r('1', 10, 10, '1'), PR: r('1', 10, 10, '1'), JM: r('1', 10, 10, '1'),
  TT: r('1', 10, 10, '1'), BS: r('1', 10, 10, '1'), BB: r('1', 10, 10, '1'), BZ: r('501', 7, 7, ''),
};

export type PhoneResult = { ok: true; phone: string | null } | { ok: false };

const BAD: PhoneResult = { ok: false };
const fits = (rule: PhoneRule, nsn: string) => nsn.length >= rule.min && nsn.length <= rule.max;
const oneDigit = (digits: string) => /^(\d)\1*$/.test(digits);

/** "55512345" → "5551 2345"; "501234567" → "50 123 4567"; "2025550123" → "202 555 0123"; other lengths as typed. */
function group(nsn: string): string {
  const cut = (...sizes: number[]) => {
    let at = 0;
    return sizes.map((n) => nsn.slice(at, (at += n))).join(' ');
  };
  switch (nsn.length) {
    case 7:
      return cut(3, 4);
    case 8:
      return cut(4, 4);
    case 9:
      return cut(2, 3, 4);
    case 10:
      return cut(3, 3, 4);
    default:
      return nsn;
  }
}

/** The country whose code starts these digits: the longest code; the salon's own country when codes are shared (+1). */
function ruleForDial(digits: string, home: PhoneRule | undefined): PhoneRule | undefined {
  let best: PhoneRule | undefined;
  for (const rule of Object.values(PHONE_RULES)) {
    if (!digits.startsWith(rule.dial)) continue;
    if (!best || rule.dial.length > best.dial.length) best = rule;
  }
  return best && home && home.dial === best.dial ? home : best;
}

/**
 * The number as it is saved, or not a number. Empty is fine (no number): `{ ok: true, phone: null }`.
 * `country` is the salon's (ISO code); without one, only a number with its country code is accepted.
 */
export function normalizePhone(input: string | null | undefined, country: string | null | undefined): PhoneResult {
  const typed = (input ?? '').trim();
  if (!typed) return { ok: true, phone: null };
  if (!/^\+?[0-9 ().-]+$/.test(typed)) return BAD;
  let digits = typed.replace(/\D/g, '');
  const home = country ? PHONE_RULES[country.toUpperCase()] : undefined;
  let rule: PhoneRule | undefined;
  let nsn: string;
  if (typed.startsWith('+') || digits.startsWith('00')) {
    if (!typed.startsWith('+')) digits = digits.slice(2);
    rule = ruleForDial(digits, home);
    if (!rule) return digits.length >= 8 && digits.length <= 15 && !oneDigit(digits) ? { ok: true, phone: `+${digits}` } : BAD;
    nsn = digits.slice(rule.dial.length);
    // "+971 050 123 4567": the local 0 typed after the code.
    if (rule.trunk && !fits(rule, nsn) && nsn.startsWith(rule.trunk) && fits(rule, nsn.slice(rule.trunk.length))) {
      nsn = nsn.slice(rule.trunk.length);
    }
  } else {
    if (!home) return BAD;
    rule = home;
    nsn = digits;
    if (rule.trunk && nsn.startsWith(rule.trunk) && fits(rule, nsn.slice(rule.trunk.length))) {
      nsn = nsn.slice(rule.trunk.length);
    } else if (!fits(rule, nsn) && nsn.startsWith(rule.dial) && fits(rule, nsn.slice(rule.dial.length))) {
      // "974 5551 2345": the code typed without the +.
      nsn = nsn.slice(rule.dial.length);
    }
  }
  if (!fits(rule, nsn) || oneDigit(nsn)) return BAD;
  return { ok: true, phone: `+${rule.dial} ${group(nsn)}` };
}

/** Empty, or a number that passes the check. */
export const phoneOk = (input: string | null | undefined, country: string | null | undefined) => normalizePhone(input, country).ok;

/** The number to save: tidied with its country code, or null when empty (call after phoneOk). */
export function phoneToSave(input: string | null | undefined, country: string | null | undefined): string | null {
  const result = normalizePhone(input, country);
  return result.ok ? result.phone : (input ?? '').trim() || null;
}
