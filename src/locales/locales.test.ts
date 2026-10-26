import ar from './ar.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import hi from './hi.json';
import pt from './pt.json';
import ur from './ur.json';

type Tree = { [key: string]: string | Tree };

/** Every [key path, text] pair, ignoring meta keys that start with "_". */
function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]): [string, string][] => {
    if (key.startsWith('_')) return [];
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[path, value]] : leaves(value, path);
  });
}

const keys = (tree: Tree) =>
  leaves(tree)
    .map(([path]) => path)
    .sort();

const placeholders = (tree: Tree) =>
  Object.fromEntries(
    leaves(tree).map(([path, text]) => [
      path,
      [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort(),
    ]),
  );

const english = en as Tree;
const translations = { ar, hi, ur, es, fr, pt } as Record<string, Tree>;

/** "x_few" → ["x", "few"]; a key without a plural ending → [key, null]. */
const pluralOf = (key: string): [string, string | null] => {
  const m = /^(.*)_(zero|one|two|few|many|other)$/.exec(key);
  return m ? [m[1] ?? key, m[2] ?? null] : [key, null];
};

/** Texts English counts: the ones with a "_one" form. */
const counted = new Set(keys(english).filter((k) => pluralOf(k)[1] === 'one').map((k) => pluralOf(k)[0]));

/** Keys a language has beyond English: allowed only as the extra plural forms of its own grammar (Arabic: zero, two,
 *  few, many) of a text English counts. */
const extraKeys = (code: string, tree: Tree) => {
  const forms = new Set<string>(new Intl.PluralRules(code).resolvedOptions().pluralCategories);
  const englishKeys = new Set(keys(english));
  const extra = keys(tree).filter((k) => !englishKeys.has(k));
  const wrong = extra.filter((k) => {
    const [base, form] = pluralOf(k);
    return form === null || !forms.has(form) || !counted.has(base);
  });
  return { extra: new Set(extra), wrong };
};

/** Arabic says "one place" and "two places" without the number, so those forms may leave out {{count}}. */
const withoutCount = (key: string, names: (string | undefined)[]) =>
  ['zero', 'one', 'two'].includes(pluralOf(key)[1] ?? '') ? names.filter((n) => n !== 'count') : names;

describe.each(Object.entries(translations))('%s locale', (code, tree) => {
  it('has the same keys as English, plus only its own plural forms', () => {
    const { extra, wrong } = extraKeys(code, tree);
    expect(wrong).toEqual([]);
    expect(keys(tree).filter((k) => !extra.has(k))).toEqual(keys(english));
  });

  it('keeps the same {{placeholders}} as English', () => {
    const theirs = placeholders(english);
    const mismatched = Object.entries(placeholders(tree)).filter(([key, names]) => {
      // An added plural form ("x_few") uses what English's general form ("x_other" or "x") uses.
      const base = pluralOf(key)[0];
      const expected = theirs[key] ?? theirs[`${base}_other`] ?? theirs[base] ?? [];
      return withoutCount(key, names).join() !== withoutCount(key, expected).join();
    });
    expect(mismatched).toEqual([]);
  });

  it('has no empty strings', () => {
    expect(leaves(tree).filter(([, text]) => text.trim() === '')).toEqual([]);
  });

  it('is flagged for human review while machine-drafted', () => {
    expect(tree._review).toMatch(/TODO review/);
  });
});
