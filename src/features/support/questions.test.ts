import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import hi from '@/locales/hi.json';
import pt from '@/locales/pt.json';
import ur from '@/locales/ur.json';

import { FAQ_IDS, faqFor, matchFaq, words, type Asker, type FaqId, type FaqItem } from './questions';

type Locale = typeof en;
/** The price answer is the website's, with the live price (CommonQuestions). */
const answer = (locale: Locale, id: FaqId) =>
  id === 'price' ? locale.auth.landing.faq.price.a : (locale.support.faq[id] as { a: string }).a;
const items: FaqItem[] = FAQ_IDS.map((id) => ({
  id,
  q: en.support.faq[id].q,
  a: answer(en, id),
}));
const top = (query: string) => matchFaq(query, items)[0]?.id;

describe('common questions', () => {
  it('has a question and an answer for every one', () => {
    for (const it of items) {
      expect(it.q.length).toBeGreaterThan(5);
      expect(it.a.length).toBeGreaterThan(10);
    }
  });

  it('finds the question someone is asking', () => {
    expect(top('I forgot my password, help')).toBe('forgotPassword');
    expect(top('how much does it cost per month?')).toBe('price');
    expect(top('the receipt is not printing')).toBe('receipts');
    expect(top('how do I refund a customer')).toBe('refund');
    expect(top('my staff cannot sign in')).toBe('staffSignIn');
    expect(top('change the open days')).toBe('openDays');
  });

  it('shows nothing for words every answer shares, or for nothing typed', () => {
    expect(matchFaq('the and how', items)).toEqual([]);
    expect(matchFaq('', items)).toEqual([]);
  });

  it('reads words in every script, marks included', () => {
    expect(words('पासवर्ड भूल गया')).toEqual(['पासवर्ड', 'भूल', 'गया']);
    expect(words('نسيت كلمة المرور')).toEqual(['نسيت', 'كلمة', 'المرور']);
  });

  it.each(Object.entries({ en, ar, hi, ur, es, fr, pt }))(
    'finds each question from its own words in %s',
    (_, locale) => {
      const local: FaqItem[] = FAQ_IDS.map((id) => ({
        id,
        q: locale.support.faq[id].q,
        a: answer(locale as Locale, id),
      }));
      for (const it of local) expect(matchFaq(it.q, local)[0]?.id).toBe(it.id);
    },
  );

  it('shows each login only the questions that fit it (E6)', () => {
    const all = { plans: true, billing: true };
    const sees = (asker: Asker) => faqFor(asker, all);
    // The brief's examples: an accountant does not set staff passwords; a stylist does not pay for the plan,
    // add staff, refund or delete the account.
    expect(sees('accountant')).not.toContain('staffPassword');
    for (const id of ['price', 'payPlan', 'addStaff', 'refund', 'deleteAccount'] as const) expect(sees('staff')).not.toContain(id);
    expect(sees('staff').slice(0, 2)).toEqual(['clockIn', 'myPay']);
    expect(sees('accountant')[0]).toBe('books');
    expect(sees('cashier')).toContain('cashClosing');
    expect(sees('manager')).toContain('staffPassword');
    for (const id of ['addService', 'addStaff', 'openDays', 'payPlan', 'deleteAccount'] as const) {
      expect(sees('owner')).toContain(id);
      expect(sees('manager')).not.toContain(id);
    }
    // Everyone gets every question somewhere, and no one a question twice.
    const asked = new Set((['owner', 'manager', 'cashier', 'staff', 'accountant', 'guest'] as const).flatMap(sees));
    expect([...asked].sort()).toEqual([...FAQ_IDS].sort());
    for (const a of ['owner', 'manager', 'cashier', 'staff', 'accountant', 'guest'] as const) expect(new Set(sees(a)).size).toBe(sees(a).length);
  });

  it('hides prices and paying unless the plan screen shows them, and a stopped plan while billing is off', () => {
    expect(faqFor('owner', { plans: false, billing: false })).not.toContain('price');
    expect(faqFor('owner', { plans: false, billing: false })).not.toContain('payPlan');
    expect(faqFor('owner', { plans: false, billing: false })).not.toContain('planInactive');
    expect(faqFor('staff', { plans: false, billing: true })).toContain('planInactive');
    expect(faqFor('guest', { plans: true, billing: false })).toContain('price');
  });
});

