/** Each login's alerts (brief B6) read in the app language from the alert's data, not the stored English text. */
import { i18n, initI18n } from '@/lib/i18n';

import { notificationText, type Formats } from './text';

const f: Formats = { at: (iso) => `@${iso.slice(11, 16)}`, day: (date, pattern) => `${pattern}:${date}` };
const words = (type: string, data: Record<string, unknown>) => notificationText({ type, title: 'stored', body: 'stored', data }, i18n.t, f);

beforeAll(() => initI18n('en'));

it('booking alerts for the stylist and the front desk', () => {
  const at = '2026-11-10T14:30:00Z';
  expect(words('booking_moved', { customer: 'Amal', at })).toEqual({ title: 'Booking moved', body: 'Amal · now @14:30' });
  expect(words('booking_moved', { customer: 'Amal', at, reassigned: true }).body).toBe('Amal · now with someone else');
  expect(words('booking_cancelled', { customer: 'Amal', at })).toEqual({ title: 'Booking cancelled', body: 'Amal · @14:30' });
  expect(words('client_arrived', { customer: null, at })).toEqual({ title: 'Client arrived', body: 'Guest is here' });
  expect(words('no_show', { customer: 'Amal', at }).title).toBe('No-show');
});

it('manager and accountant alerts', () => {
  expect(words('missed_clock_out', { name: 'Omar', date: '2026-11-09' }).body).toBe('Omar · EEE d MMM:2026-11-09 · no clock-out');
  expect(words('bill_due', { supplier: 'Gulf Beauty', due: '2026-11-12', left_minor: 14175 })).toEqual({
    title: 'Bill due EEE d MMM:2026-11-12',
    body: 'Gulf Beauty · AED\u00a0141.75 left to pay',
  });
  expect(words('month_ready', { month: '2026-10' }).body).toBe('MMMM yyyy:2026-10-01 is over: check it and close it.');
  expect(words('delivery_waiting', { number: 3 })).toEqual({ title: 'Delivery to price', body: 'Delivery 3 is waiting for prices' });
});

it("the owner's money alerts: cash differences, refunds and discounts over the limit", () => {
  expect(words('cash_difference', { date: '2026-11-09', variance_minor: -2500, counted_by: 'Rana', reason: 'Gave wrong change' })).toEqual({
    title: 'Cash short AED\u00a025.00 on EEE d MMM:2026-11-09',
    body: 'Counted by Rana · Reason: Gave wrong change',
  });
  expect(words('cash_difference', { date: '2026-11-09', variance_minor: 3000, counted_by: 'Rana', reason: null }).title).toBe('Cash over AED\u00a030.00 on EEE d MMM:2026-11-09');
  expect(words('refund_made', { action: 'refund', amount: 5000, by: 'Rana', approved_by: 'Mona', reason: 'Unhappy' })).toEqual({
    title: 'Refund AED\u00a050.00',
    body: 'Rana · approved by Mona · Reason: Unhappy',
  });
  expect(words('refund_made', { action: 'deposit_refund', amount: 2000, by: 'Mona', approved_by: 'Mona', reason: null })).toEqual({
    title: 'Deposit given back AED\u00a020.00',
    body: 'Mona',
  });
  expect(words('discount_over_limit', { action: 'discount', amount: 2500, limit: 1000, by: 'Rana', approved_by: 'Mona', reason: null }).title).toBe(
    'Discount 25% (limit 10%)',
  );
});

it('an alert type the app has no words for shows the stored text', () => {
  expect(words('something_new', {})).toEqual({ title: 'stored', body: 'stored' });
});
