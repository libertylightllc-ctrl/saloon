import { customerSearch } from './api';

it('searches a number by its digits, a name by name or number (F1)', () => {
  expect(customerSearch('050 123 4567')).toEqual({ digits: '%501234567%' });
  expect(customerSearch('+974 5551 2345')).toEqual({ digits: '%97455512345%' });
  expect(customerSearch('5551')).toEqual({ digits: '%5551%' });
  expect(customerSearch('Rose')).toEqual({ or: 'name.ilike.%Rose%,phone.ilike.%Rose%' });
  expect(customerSearch('12')).toEqual({ or: 'name.ilike.%12%,phone.ilike.%12%' });
});
