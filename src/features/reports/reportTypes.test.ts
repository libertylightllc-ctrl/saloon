import { reportTypesFor } from './api';

const on = { vat_mode: 'on' };
const off = { vat_mode: 'off' };

it('lists the VAT report only while the branch is registered for VAT (F2)', () => {
  expect(reportTypesFor('owner', on)).toContain('vat');
  expect(reportTypesFor('accountant', on)).toContain('vat');
  expect(reportTypesFor('owner', off)).not.toContain('vat');
  expect(reportTypesFor('accountant', off)).not.toContain('vat');
  expect(reportTypesFor('owner', off)).toEqual(['monthly', 'staff', 'closing', 'stock', 'shortages', 'no_shows', 'customers']);
  // Managers and stylists never had it.
  expect(reportTypesFor('manager', on)).not.toContain('vat');
  expect(reportTypesFor('staff', on)).toEqual(['staff']);
});
