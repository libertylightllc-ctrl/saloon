/**
 * Test helper: the sentences a SQL text expression can make, read from the migrations (owner's app checks E3 and E8).
 * Used by activityText.test.ts (audit sentences) and journalTitle.test.ts (journal notes); not part of the app.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const dir = join(__dirname, '../../../supabase/migrations');

/** Splits at a separator outside quotes, brackets and case … end. */
export function splitTop(expr: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cases = 0;
  let quote = false;
  let cur = '';
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i]!;
    if (quote) {
      cur += c;
      if (c === "'") {
        if (expr[i + 1] === "'") {
          cur += "'";
          i++;
        } else quote = false;
      }
      continue;
    }
    if (c === "'") quote = true;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    const word = /^[a-z_]/i.test(c) && !/[a-z0-9_.]/i.test(expr[i - 1] ?? ' ') ? /^[a-z_]+/i.exec(expr.slice(i))![0] : '';
    if (word.toLowerCase() === 'case') cases++;
    if (word.toLowerCase() === 'end') cases--;
    if (depth === 0 && cases === 0 && expr.startsWith(sep, i)) {
      out.push(cur.trim());
      cur = '';
      i += sep.length - 1;
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

const literal = (s: string) => (/^'(?:[^']|'')*'$/.test(s) ? s.slice(1, -1).replace(/''/g, "'") : null);

/** A value a SQL expression could give, close enough to the real thing to be matched. */
function atom(expr: string): string {
  const e = expr.toLowerCase();
  if (e.includes('fmt_money')) return 'AED 12.50';
  if (e.startsWith('to_char')) {
    const fmt = [...expr.matchAll(/'([^']*)'/g)].pop()?.[1] ?? '';
    const sample: Record<string, string> = {
      'HH24:MI': '09:30',
      'DD Mon': '05 Oct',
      'FMDD Mon': '5 Oct',
      'DD Mon YYYY': '05 Oct 2026',
      'YYYY-MM-DD': '2026-10-05',
      'FM999999990.00': '50.00',
    };
    if (!(fmt in sample)) throw new Error(`no sample for to_char format ${fmt}`);
    return sample[fmt]!;
  }
  if (e.includes('purchase_no')) return 'PUR-00012';
  if (/\bbusiness_date$/.test(e)) return '2026-10-05';
  if (e.includes('doc_label')) return 'Trade licence';
  if (e.startsWith('initcap')) return 'Bonus';
  if (/\bperiod\b|p_month\b|p_period\b/.test(e)) return '2026-10';
  if (e.includes('v_method')) return 'bank';
  if (/\.kind\b|\bv_kind\b/.test(e)) return 'bonus';
  if (e.includes('role::text')) return 'manager';
  if (e.includes('mode::text')) return 'ladies';
  if (e.includes('free_until')) return '2026-12-31';
  if (e.includes('trim_scale')) return '-2';
  if (/number|v_items|v_changed|v_sort|minutes|count\(|array_length|floor\(|p_months|::int/.test(e)) return '3';
  return 'Sample Name';
}

/** Every sentence a summary expression can make (each branch of a case, each side of a coalesce). */
export function samples(expr: string): string[] {
  let variants = [''];
  for (const part of splitTop(expr.trim(), '||')) {
    const options = pieces(part);
    variants = variants.flatMap((v) => options.map((o) => v + o)).slice(0, 64);
  }
  return variants;
}

function pieces(part: string): string[] {
  const lit = literal(part);
  if (lit !== null) return [lit];
  const lower = part.toLowerCase();
  if (lower.startsWith('(') && lower.endsWith(')') && splitTop(part.slice(1, -1), '||').length > 1) return samples(part.slice(1, -1));
  if (/^case\b/.test(lower)) {
    const body = part.replace(/^case\b/i, '').replace(/\bend$/i, '');
    return splitTop(body.replace(/\b(when|then|else)\b/gi, '\u0001$1'), '\u0001')
      .filter((b) => /^(then|else)\b/i.test(b))
      .flatMap((b) => samples(b.replace(/^(then|else)\b/i, '')));
  }
  if (lower.startsWith('coalesce(')) {
    const args = splitTop(part.slice('coalesce('.length, -1), ',');
    return [...samples(args[0]!), ...samples(args[args.length - 1]!)];
  }
  if (lower.startsWith('nullif(')) return samples(splitTop(part.slice('nullif('.length, -1), ',')[0]!);
  return [atom(part)];
}

/** One argument (0-based) of every call to `fn` in the migrations (not its definition, nor a list of argument types). */
export function callArguments(fn: string, index: number): string[] {
  const found = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, file), 'utf8').replace(/--[^\n]*/g, '');
    for (const m of sql.matchAll(new RegExp(`${fn}\\s*\\(`, 'g'))) {
      if (/function\s+public\.$/i.test(sql.slice(Math.max(0, m.index - 20), m.index))) continue;
      let depth = 0;
      let end = m.index + m[0].length - 1;
      let quote = false;
      for (; end < sql.length; end++) {
        const c = sql[end]!;
        if (c === "'") quote = !quote;
        if (quote) continue;
        if (c === '(') depth++;
        if (c === ')' && --depth === 0) break;
      }
      const args = splitTop(sql.slice(m.index + m[0].length, end), ',');
      if (args.length > index && !/^(uuid|text)$/i.test(args[0]!)) found.add(args[index]!.replace(/\s+/g, ' '));
    }
  }
  return [...found];
}
