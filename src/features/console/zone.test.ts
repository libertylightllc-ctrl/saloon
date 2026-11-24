import { zoneCity } from './zone';

it('names a time zone by its city', () => {
  expect(zoneCity('Asia/Qatar')).toBe('Doha');
  expect(zoneCity('Asia/Dubai')).toBe('Dubai');
  expect(zoneCity('America/New_York')).toBe('New York');
  expect(zoneCity('Asia/Kolkata')).toBe('Kolkata');
});
