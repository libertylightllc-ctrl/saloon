import { otherSalons } from './duplicates';

describe('otherSalons', () => {
  it('gives names, with the code only where a name repeats or is the salon’s own', () => {
    expect(otherSalons([{ name: 'Red Rose', code: 'redrose' }], 'Asil Trims')).toBe('Red Rose');
    expect(
      otherSalons(
        [
          { name: "Tehseem's Salon", code: 'tehseems22' },
          { name: "Tehseem's Salon", code: 'tehseem7' },
          { name: 'Red Rose', code: 'redrose' },
        ],
        'Asil Trims',
      ),
    ).toBe("Tehseem's Salon (tehseems22), Tehseem's Salon (tehseem7), Red Rose");
    expect(otherSalons([{ name: "Tehseem's Salon", code: 'tehseem7' }], "tehseem's salon")).toBe("Tehseem's Salon (tehseem7)");
  });
});
