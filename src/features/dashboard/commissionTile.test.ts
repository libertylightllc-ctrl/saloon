import { showsCommission } from './api';

it('leaves out "Commission this month" for a 0% stylist with nothing earned (E8)', () => {
  expect(showsCommission(0, 0)).toBe(false);
  expect(showsCommission(1000, 0)).toBe(true);
  // The rate went to 0% this month after some was earned: still shown.
  expect(showsCommission(0, 350)).toBe(true);
  // Loading: shown only if earned; not readable: shown as before.
  expect(showsCommission(undefined, 0)).toBe(false);
  expect(showsCommission(undefined, 350)).toBe(true);
  expect(showsCommission(null, 0)).toBe(true);
});
