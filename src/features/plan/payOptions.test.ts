/** The ways the plan page offers to pay (website brief 5.3). */
import { payOptions, type CardPrice } from './cardApi';

const price = (card_payments: CardPrice['card_payments'], bank_transfer: boolean) =>
  ({ card_payments, bank_transfer, intl_price_per_branch_minor: 1399, intl_extra_person_minor: 300, intl_currency: 'USD', included_people: 4 }) as CardPrice;

it('offers the card while card payments are live, and bank transfer only once it is switched on', () => {
  expect(payOptions(price('live', false), false)).toEqual({ card: true, bank: false, contact: false });
  expect(payOptions(price('live', true), false)).toEqual({ card: true, bank: true, contact: false });
});

it('in test, the card is for platform owners only; with no way to pay, the owner is asked to contact us', () => {
  expect(payOptions(price('test', false), true)).toEqual({ card: true, bank: false, contact: false });
  expect(payOptions(price('test', false), false)).toEqual({ card: false, bank: false, contact: true });
  expect(payOptions(price('off', false), false)).toEqual({ card: false, bank: false, contact: true });
  expect(payOptions(undefined, false)).toEqual({ card: false, bank: false, contact: false });
});
