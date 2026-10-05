import { clockPattern, clockText, setTwelveHourClock } from './clock';

describe('clock', () => {
  afterEach(() => setTwelveHourClock(false));

  it('keeps 24-hour times on a 24-hour device', () => {
    setTwelveHourClock(false);
    expect(clockPattern('d MMM · HH:mm')).toBe('d MMM · HH:mm');
    expect(clockText('21:30')).toBe('21:30');
    expect(clockText('9:05:00')).toBe('09:05');
  });

  it('writes 12-hour times on a 12-hour device', () => {
    setTwelveHourClock(true);
    expect(clockPattern('d MMM · HH:mm')).toBe('d MMM · h:mm a');
    expect(clockText('21:30')).toBe('9:30 PM');
    expect(clockText('00:15')).toBe('12:15 AM');
    expect(clockText('12:00')).toBe('12:00 PM');
    expect(clockText('09:00:00')).toBe('9:00 AM');
  });

  it('leaves anything that is not a time alone', () => {
    setTwelveHourClock(true);
    expect(clockText('—')).toBe('—');
  });
});
