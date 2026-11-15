import { refundEffect } from './refundEffect';

const sale = {
  total_minor: 4500,
  tip_minor: 500,
  tip_employee_id: 'marie',
  sale_lines: [
    { employee_id: 'marie', commission_minor: 1400 },
    { employee_id: 'lina', commission_minor: 700 },
  ],
};

it('takes back the commission on the refunded part, without the tip, as payroll does (E7)', () => {
  // QAR 10 of a QAR 40 sale (tip apart): a quarter of Marie's QAR 14 commission; the tip is kept.
  expect(refundEffect(sale, { amount_minor: 1000, tip_minor: 0 }, 'marie')).toEqual({ commission_minor: 350, tip_minor: 0 });
  // The whole sale with the tip: all the commission and the whole tip.
  expect(refundEffect(sale, { amount_minor: 4500, tip_minor: 500 }, 'marie')).toEqual({ commission_minor: 1400, tip_minor: 500 });
});

it('names the tip only for the one it was for', () => {
  expect(refundEffect(sale, { amount_minor: 1000, tip_minor: 0 }, 'lina')).toEqual({ commission_minor: 175, tip_minor: null });
  expect(refundEffect({ ...sale, tip_minor: 0 }, { amount_minor: 1000, tip_minor: 0 }, 'marie').tip_minor).toBeNull();
});
