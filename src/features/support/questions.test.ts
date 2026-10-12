import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import hi from '@/locales/hi.json';
import pt from '@/locales/pt.json';
import ur from '@/locales/ur.json';

import { FAQ_IDS, matchFaq, words, type FaqItem } from './questions';

const items: FaqItem[] = FAQ_IDS.map((id) => ({
  id,
  q: en.support.faq[id].q,
  a: en.support.faq[id].a,
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
        a: locale.support.faq[id].a,
      }));
      for (const it of local) expect(matchFaq(it.q, local)[0]?.id).toBe(it.id);
    },
  );
});
