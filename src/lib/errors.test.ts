import { AppError, errorCode, errorDetail } from './errors';

describe('errorCode', () => {
  it('reads RPC codes with and without detail', () => {
    expect(errorCode({ message: 'payment_mismatch: due 7000 paid 6000' })).toBe('payment_mismatch');
    expect(errorCode({ message: 'slot_taken' })).toBe('slot_taken');
    expect(errorDetail({ message: 'insufficient_stock: Beard Color, Gloves' })).toBe('Beard Color, Gloves');
  });

  it('recognises auth and network failures', () => {
    expect(errorCode(new Error('Invalid login credentials'))).toBe('wrong_password');
    expect(errorCode(new Error('User is banned'))).toBe('disabled');
    expect(errorCode(new TypeError('Network request failed'))).toBe('no_internet');
    expect(errorCode(new TypeError('Failed to fetch'))).toBe('no_internet');
    expect(errorCode(new Error('User already registered'))).toBe('email_taken');
    expect(errorCode(new Error('Token has expired or is invalid'))).toBe('invalid_code');
  });

  it('tells a slow or failing server apart from a wrong password', () => {
    // GoTrue's own deadline (504), a database statement timeout and a gateway error.
    expect(errorCode({ message: 'Processing this request timed out, please retry after a moment.', status: 504 })).toBe('server_busy');
    expect(errorCode({ message: 'canceling statement due to statement timeout', code: '57014' })).toBe('server_busy');
    expect(errorCode({ message: 'An invalid response was received from the upstream server', status: 502 })).toBe('server_busy');
    expect(errorCode({ message: 'Invalid login credentials', status: 400 })).toBe('wrong_password');
  });

  it('falls back to permission and unknown', () => {
    expect(errorCode({ message: 'permission denied for table services', code: '42501' })).toBe('not_allowed');
    expect(errorCode(new Error('something odd'))).toBe('unknown');
    expect(errorCode(new AppError('unknown_salon'))).toBe('unknown_salon');
  });
});
