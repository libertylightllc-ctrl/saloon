import { fireEvent, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';

import { useTerms } from '@/features/mode/useTerms';
import type { Mode } from '@/theme';

import { initials } from './Avatar';
import { Button } from './Button';
import { HeaderBand, useOnBand } from './HeaderBand';
import { MoneyInput } from './MoneyInput';
import { StatusPill } from './StatusPill';
import { Stepper } from './Stepper';
import { renderInApp } from './testUtils';

describe('Stepper', () => {
  it('shows Add at zero, then counts', async () => {
    const onChange = jest.fn();
    const { rerender } = await renderInApp(
      <Stepper value={0} onChange={onChange} itemLabel="Haircut" />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Add Haircut' }));
    expect(onChange).toHaveBeenLastCalledWith(1);

    await rerender(<Stepper value={2} onChange={onChange} itemLabel="Haircut" />);
    expect(screen.getByText('2')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'One more Haircut' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await fireEvent.press(screen.getByRole('button', { name: 'One less Haircut' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });
});

describe('Button', () => {
  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await renderInApp(<Button label="Save sale" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save sale' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('StatusPill', () => {
  it('uses the translated status name', async () => {
    await renderInApp(<StatusPill status="in_progress" />);
    expect(screen.getByText('In progress')).toBeOnTheScreen();
  });
});

describe('MoneyInput', () => {
  it('turns typed text into fils and flags junk', async () => {
    const onChange = jest.fn();
    await renderInApp(<MoneyInput label="Cash counted" value={null} onChange={onChange} />);
    const input = screen.getByLabelText('Cash counted');
    await fireEvent.changeText(input, '25.5');
    expect(onChange).toHaveBeenLastCalledWith(2550);
    await fireEvent.changeText(input, '25.555');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText('Enter an amount like 25 or 25.50.')).toBeOnTheScreen();
  });
});

function BandProbe() {
  return <RNText>{useOnBand() ? 'on band' : 'off band'}</RNText>;
}

describe.each<[Mode, string]>([
  ['gents', 'on band'],
  ['ladies', 'off band'],
])('HeaderBand in %s', (mode, expected) => {
  it(`puts its children ${expected}`, async () => {
    await renderInApp(
      <HeaderBand title="Queue">
        <BandProbe />
      </HeaderBand>,
      { mode },
    );
    expect(screen.getByText('Queue')).toBeOnTheScreen();
    expect(screen.getByText(expected)).toBeOnTheScreen();
  });
});

function TermsProbe() {
  const terms = useTerms();
  return <RNText>{`${terms.staff} · ${terms.station} · ${terms.anyStaff}`}</RNText>;
}

describe('useTerms', () => {
  it('follows the mode', async () => {
    await renderInApp(<TermsProbe />, { mode: 'gents' });
    expect(screen.getByText('Barber · Chair · Any barber')).toBeOnTheScreen();
  });

  it('says Stylist in ladies mode', async () => {
    await renderInApp(<TermsProbe />, { mode: 'ladies' });
    expect(screen.getByText('Stylist · Station · Any stylist')).toBeOnTheScreen();
  });
});

describe('initials', () => {
  it('takes the first and last word', () => {
    expect(initials('Ahmed Khan')).toBe('AK');
    expect(initials('Fatima Al Mansoori')).toBe('FM');
    expect(initials('Rafiq')).toBe('R');
    expect(initials('  ')).toBe('');
  });
});
