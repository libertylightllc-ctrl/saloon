import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Text as RNText } from 'react-native';

import { useTerms } from '@/features/mode/useTerms';
import type { Mode } from '@/theme';

import { initials } from './Avatar';
import { Button } from './Button';
import { DateField } from './DateField';
import { HeaderBand } from './HeaderBand';
import { useOnBand } from './layoutContext';
import { MoneyInput } from './MoneyInput';
import { QueryState } from './QueryState';
import { StatusPill } from './StatusPill';
import { Stepper } from './Stepper';
import { SuccessCheck } from './SuccessCheck';
import { renderInApp, warmUpRendering } from './testUtils';

warmUpRendering();

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

  it('uses letters only (a numbered name keeps its letter)', () => {
    expect(initials('Red 001')).toBe('R');
    expect(initials('Staff 2 Noor')).toBe('SN');
    expect(initials('007')).toBe('');
    expect(initials('مريم')).toBe('م');
  });
});

describe('SuccessCheck', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the finished check without animating when Reduce Motion is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const spring = jest.spyOn(Animated, 'spring');
    await renderInApp(<SuccessCheck />);
    await waitFor(() =>
      expect(screen.getByTestId('success-check', { includeHiddenElements: true })).toHaveStyle({
        opacity: 1,
      }),
    );
    expect(spring).not.toHaveBeenCalled();
  });

  it('animates the check when Reduce Motion is off', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const spring = jest.spyOn(Animated, 'spring');
    await renderInApp(<SuccessCheck />);
    await waitFor(() => expect(spring).toHaveBeenCalledTimes(2));
  });
});

describe('QueryState', () => {
  const loaded = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: () => undefined });
  const list = (rows: string[]) => <RNText>{rows.join(', ')}</RNText>;

  it('says a list is empty when it has nothing in it', async () => {
    await renderInApp(
      <QueryState query={loaded<string[]>([])} empty="No codes yet.">
        {list}
      </QueryState>,
    );
    expect(screen.getByText('No codes yet.')).toBeTruthy();
  });

  it('shows the list when it has rows, and the screen’s own empty rule wins', async () => {
    const { rerender } = await renderInApp(
      <QueryState query={loaded(['PILOT-DXB-07'])} empty="No codes yet.">
        {list}
      </QueryState>,
    );
    expect(screen.getByText('PILOT-DXB-07')).toBeTruthy();
    expect(screen.queryByText('No codes yet.')).toBeNull();
    await rerender(
      <QueryState query={loaded(['only one'])} isEmpty={(rows) => rows.length < 2} empty="Nothing to compare.">
        {list}
      </QueryState>,
    );
    expect(screen.getByText('Nothing to compare.')).toBeTruthy();
  });
});

describe('DateField', () => {
  it('picks a day on the month calendar instead of typing it, and an optional date can be cleared', async () => {
    const onChange = jest.fn();
    const { rerender } = await renderInApp(
      <DateField label="Expires" value="" onChange={onChange} min="2027-01-10" clearable testID="expires" />,
    );
    expect(screen.getByText('Choose a date')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('expires'));
    // January 2027 opens (the first day that can be picked); days before it cannot be picked.
    expect(screen.getByText('January 2027')).toBeOnTheScreen();
    expect(screen.getByTestId('expires-day-2027-01-09')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('expires-day-2027-01-24'));
    expect(onChange).toHaveBeenLastCalledWith('2027-01-24');
    expect(screen.queryByTestId('expires-calendar')).toBeNull();

    await rerender(<DateField label="Expires" value="2027-01-24" onChange={onChange} clearable testID="expires" />);
    expect(screen.getByText('24 Jan 2027')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('expires-clear'));
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
