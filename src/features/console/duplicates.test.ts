import { otherSalons } from './duplicates';

describe('otherSalons', () => {
  it('gives names, with the code only where a name repeats or is the salon’s own', () => {
    expect(otherSalons([{ name: 'Cedar Cuts', code: 'cedarcuts' }], 'Blue Comb')).toBe('Cedar Cuts');
    expect(
      otherSalons(
        [
          { name: "Palm Salon", code: 'palm22' },
          { name: "Palm Salon", code: 'palm7' },
          { name: 'Cedar Cuts', code: 'cedarcuts' },
        ],
        'Blue Comb',
      ),
    ).toBe("Palm Salon (palm22), Palm Salon (palm7), Cedar Cuts");
    expect(otherSalons([{ name: "Palm Salon", code: 'palm7' }], "palm salon")).toBe("Palm Salon (palm7)");
  });
});
