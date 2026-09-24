import ar from './ar.json';
import en from './en.json';
import hi from './hi.json';
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
const translations = { ar, hi, ur } as Record<string, Tree>;

describe.each(Object.entries(translations))('%s locale', (_code, tree) => {
  it('has exactly the same keys as English', () => {
    expect(keys(tree)).toEqual(keys(english));
  });

  it('keeps the same {{placeholders}} as English', () => {
    expect(placeholders(tree)).toEqual(placeholders(english));
  });

  it('has no empty strings', () => {
    expect(leaves(tree).filter(([, text]) => text.trim() === '')).toEqual([]);
  });

  it('is flagged for human review while machine-drafted', () => {
    expect(tree._review).toMatch(/TODO review/);
  });
});
