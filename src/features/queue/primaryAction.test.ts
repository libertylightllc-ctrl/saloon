import { primaryAction } from './actions';

describe('primaryAction', () => {
  it('moves a visit along: check in → start → complete', () => {
    expect(primaryAction('booked')).toBe('checkIn');
    expect(primaryAction('waiting')).toBe('start');
    expect(primaryAction('in_progress')).toBe('complete');
    expect(primaryAction('completed')).toBeNull();
  });

  it('offers Complete (which opens checkout) only to people who can take payment', () => {
    expect(primaryAction('in_progress', false)).toBeNull();
    expect(primaryAction('waiting', false)).toBe('start');
  });
});
