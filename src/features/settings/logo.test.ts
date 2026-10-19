import { fitLogo } from './logo';

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: {} }));

describe('fitLogo', () => {
  it('shrinks a wide logo to 600 across, keeping its shape', () => {
    expect(fitLogo(1200, 400)).toEqual({ width: 600, height: 200 });
  });
  it('shrinks a tall one to 240 high', () => {
    expect(fitLogo(800, 800)).toEqual({ width: 240, height: 240 });
  });
  it('never enlarges a small one', () => {
    expect(fitLogo(300, 100)).toEqual({ width: 300, height: 100 });
  });
});
