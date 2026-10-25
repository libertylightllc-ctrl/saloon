/** The prices the full update brief expects (Phase 2), worked out from the config. */
import { BILLING_LENGTHS, branchMonthly, lengthTotal, peoplePerBranch, priceText, salonMonthly } from './pricing';

const AED = { baseMinor: 5000, extraMinor: 1000, includedPeople: 4 };
const USD = { baseMinor: 1399, extraMinor: 299, includedPeople: 4 };
const totals = (minor: number) => BILLING_LENGTHS.map((l) => lengthTotal(minor, l));

it('per branch: 1, 6 and 12 months', () => {
  expect(totals(AED.baseMinor)).toEqual([5000, 27000, 50000]);
  expect(totals(USD.baseMinor)).toEqual([1399, 7555, 13990]);
  expect(totals(AED.extraMinor)).toEqual([1000, 5400, 10000]);
  expect(totals(USD.extraMinor)).toEqual([299, 1615, 2990]);
});

it('per branch, for up to 4 people, then each extra person', () => {
  expect(branchMonthly(4, AED)).toBe(5000);
  expect(branchMonthly(6, AED)).toBe(7000);
  expect(salonMonthly([5, 5], AED)).toBe(12000);
  expect(branchMonthly(6, USD)).toBe(1997);
  expect(salonMonthly([5, 5], USD)).toBe(3396);
});

it('the owner and an accountant count once, at the first branch', () => {
  const people = [{ branchOf: null }, { branchOf: null }, { branchOf: 'a' }, { branchOf: 'b' }, { branchOf: 'b' }];
  expect(peoplePerBranch(['a', 'b'], people)).toEqual([3, 2]);
});

it('whole amounts without ".00"', () => {
  expect(priceText(5000, 'AED')).toBe('AED 50');
  expect(priceText(27000, 'AED')).toBe('AED 270');
  expect(priceText(1399, 'USD')).toBe('USD 13.99');
  expect(priceText(13990, 'USD')).toBe('USD 139.90');
  expect(priceText(120000, 'AED')).toBe('AED 1,200');
});
