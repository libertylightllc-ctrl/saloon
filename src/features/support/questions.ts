/**
 * Common questions, answered without anyone (owner, 2026-10-12: a free way). The words are in the app's languages
 * (support.faq.<id>); while someone types, the questions that share their rarer words come up first.
 */
export const FAQ_IDS = [
  'forgotPassword',
  'staffPassword',
  'staffSignIn',
  'loginDisabled',
  'price',
  'payPlan',
  'planInactive',
  'addService',
  'addStaff',
  'openDays',
  'receipts',
  'refund',
  'sync',
  'language',
  'cashClosing',
  'deleteAccount',
] as const;

export type FaqId = (typeof FAQ_IDS)[number];
export interface FaqItem {
  id: FaqId;
  q: string;
  a: string;
}

/** Words of any script (letters with their marks, digits), lower-cased. */
export function words(text: string): string[] {
  return text
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((w) => w.length >= 3);
}

/**
 * The questions that best match what someone wrote: each shared word counts by how rare it is among the questions
 * (so "the", "how" or "my" count for nothing), twice when it is in the question itself.
 */
export function matchFaq(query: string, items: readonly FaqItem[], limit = 3): FaqItem[] {
  const asked = new Set(words(query));
  if (!asked.size) return [];
  const docs = items.map((it) => ({ it, q: new Set(words(it.q)), a: new Set(words(it.a)) }));
  // A word found in more than half of them ("more", "the", "how") says nothing about which one is meant.
  const common = docs.length / 2;
  const rarity = (w: string) => {
    const n = docs.filter((d) => d.q.has(w) || d.a.has(w)).length;
    return n && n <= common ? Math.log(docs.length / n) : 0;
  };
  return docs
    .map((d) => {
      let score = 0;
      for (const w of asked) {
        if (d.q.has(w)) score += 2 * rarity(w);
        else if (d.a.has(w)) score += rarity(w);
      }
      return { it: d.it, score };
    })
    .filter((s) => s.score >= 1.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.it);
}
