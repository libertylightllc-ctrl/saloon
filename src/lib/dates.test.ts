import {
  atBusinessTime,
  businessDate,
  businessDayBounds,
  businessMonth,
  formatDayLabel,
  isBusinessDate,
  minutesBetween,
  monthKey,
  shiftBusinessDate,
} from './dates';

describe('businessDate', () => {
  it('uses Dubai time by default, not UTC', () => {
    // 19:59 UTC is 23:59 in Dubai; 20:00 UTC is midnight — the next business date.
    expect(businessDate(new Date('2026-09-22T19:59:00Z'))).toBe('2026-09-22');
    expect(businessDate(new Date('2026-09-22T20:00:00Z'))).toBe('2026-09-23');
    expect(businessDate(new Date('2026-09-22T00:30:00Z'))).toBe('2026-09-22');
  });

  it('follows the branch timezone when given', () => {
    const at = new Date('2026-09-22T19:00:00Z');
    expect(businessDate(at, 'Asia/Dubai')).toBe('2026-09-22'); // 23:00
    expect(businessDate(at, 'Asia/Kolkata')).toBe('2026-09-23'); // 00:30
    expect(businessDate(at, 'America/New_York')).toBe('2026-09-22'); // 15:00
  });

  it('gives the business month', () => {
    expect(businessMonth(new Date('2026-09-30T20:00:00Z'))).toBe('2026-10');
  });
});

describe('businessDayBounds', () => {
  it('covers midnight to midnight in Dubai', () => {
    const { start, end } = businessDayBounds('2026-09-22');
    expect(start.toISOString()).toBe('2026-09-21T20:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-22T20:00:00.000Z');
  });

  it('handles a 23-hour daylight-saving day', () => {
    const { start, end } = businessDayBounds('2026-03-29', 'Europe/London');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });
});

describe('atBusinessTime', () => {
  it('turns a Dubai wall-clock time into an instant', () => {
    expect(atBusinessTime('2026-09-22', '15:30').toISOString()).toBe('2026-09-22T11:30:00.000Z');
  });

  it('rejects bad input', () => {
    expect(() => atBusinessTime('2026-09-22', '25:00')).toThrow(RangeError);
    expect(() => atBusinessTime('2026-02-30', '10:00')).toThrow(RangeError);
  });
});

describe('shiftBusinessDate', () => {
  it('moves across months, years and leap days', () => {
    expect(shiftBusinessDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftBusinessDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftBusinessDate('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftBusinessDate('2026-09-22', -7)).toBe('2026-09-15');
  });
});

describe('validation and formatting', () => {
  it('validates calendar dates', () => {
    expect(isBusinessDate('2026-09-22')).toBe(true);
    expect(isBusinessDate('2026-02-29')).toBe(false);
    expect(isBusinessDate('2028-02-29')).toBe(true);
    expect(isBusinessDate('22/09/2026')).toBe(false);
  });

  it('gives month keys', () => {
    expect(monthKey('2026-09-22')).toBe('2026-09');
    expect(() => monthKey('2026-13-01')).toThrow(RangeError);
  });

  it('formats day labels like the screens', () => {
    expect(formatDayLabel('2026-09-22')).toBe('Tue 22 Sep');
  });

  it('counts whole minutes', () => {
    const checkedIn = new Date('2026-09-22T10:00:00Z');
    expect(minutesBetween(checkedIn, new Date('2026-09-22T10:06:59Z'))).toBe(6);
    expect(minutesBetween(new Date('2026-09-22T10:25:00Z'), checkedIn)).toBe(-25);
  });
});
