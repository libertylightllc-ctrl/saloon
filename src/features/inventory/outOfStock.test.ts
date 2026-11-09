/**
 * Out-of-stock items are counted (owner's app check A6, 9 Nov 2026): below zero asks for a stock count, 0 is out of
 * stock, and the morning summary says out of stock and low apart, each only when there is something to say.
 */
import { digestParts } from '@/features/notifications/NotificationsScreen';
import { i18n, initI18n } from '@/lib/i18n';

import { stockPill } from './labels';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
// The shared UI's bottom sheet needs native animation modules the test renderer lacks.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

beforeAll(() => initI18n('en'));

it('the stock pill: count needed below zero, out of stock at 0, low above', () => {
  expect(stockPill({ qty: -1 }, i18n.t)).toEqual({ status: 'out_of_stock', label: 'Stock count needed' });
  expect(stockPill({ qty: 0 }, i18n.t)).toEqual({ status: 'out_of_stock' });
  expect(stockPill({ qty: 2 }, i18n.t)).toEqual({ status: 'low' });
});

it('the morning summary says each part only when there is something to say', () => {
  expect(digestParts({ pending_closes: 0, out_of_stock: 3, low_stock: 1 }, i18n.t)).toEqual(['Out of stock: 3', 'Low stock: 1']);
  expect(digestParts({ pending_closes: 1, low_stock: 0 }, i18n.t)).toEqual(['Closes to approve: 1']);
  // A summary sent before this change has no out-of-stock count.
  expect(digestParts({ low_stock: 2 }, i18n.t)).toEqual(['Low stock: 2']);
});
