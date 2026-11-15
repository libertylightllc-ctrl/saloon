/**
 * Common questions, answered without anyone (owner, 2026-10-12: a free way). The words are in the app's languages
 * (support.faq.<id>); while someone types, the questions that share their rarer words come up first. Each login sees
 * the questions that fit it (owner's app check E6), most useful first.
 */
import type { Role } from '@/lib/permissions';

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
  'clockIn',
  'myPay',
  'books',
] as const;

export type FaqId = (typeof FAQ_IDS)[number];

/** Who is asking: a login type, or a visitor on Contact us (not signed in). */
export type Asker = Role | 'guest';

/** The questions each one sees, in order. Only what that login can do (the brief's B2 table); a visitor gets the
 *  questions of someone who cannot sign in or is choosing Saloqo. */
const FOR: Record<Asker, readonly FaqId[]> = {
  owner: [
    'forgotPassword', 'staffPassword', 'staffSignIn', 'loginDisabled', 'price', 'payPlan', 'planInactive', 'addService',
    'addStaff', 'openDays', 'receipts', 'refund', 'sync', 'language', 'cashClosing', 'books', 'clockIn', 'deleteAccount',
  ],
  manager: ['staffPassword', 'cashClosing', 'refund', 'clockIn', 'receipts', 'staffSignIn', 'forgotPassword', 'sync', 'planInactive', 'language'],
  cashier: ['cashClosing', 'refund', 'receipts', 'clockIn', 'forgotPassword', 'sync', 'planInactive', 'language'],
  staff: ['clockIn', 'myPay', 'receipts', 'forgotPassword', 'sync', 'planInactive', 'language'],
  accountant: ['books', 'forgotPassword', 'sync', 'planInactive', 'language'],
  guest: ['forgotPassword', 'staffSignIn', 'loginDisabled', 'price', 'language', 'deleteAccount'],
};

/**
 * The questions for this asker. `plans`: prices and paying may be shown (billing on, the salon not free, and not in
 * a phone app — the plan screen's own rule); `billing`: billing is on, so a plan can stop new work.
 */
export function faqFor(asker: Asker, { plans, billing }: { plans: boolean; billing: boolean }): FaqId[] {
  return FOR[asker].filter((id) => (id === 'price' || id === 'payPlan' ? plans : id === 'planInactive' ? billing : true));
}
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
