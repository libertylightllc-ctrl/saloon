import { tokensFrom } from './google';

jest.mock('@/lib/supabase', () => ({ supabase: {}, supabaseUrl: 'http://x', supabaseAnonKey: 'k' }));

describe('tokensFrom', () => {
  it('reads the session Google sign-in returns after # or ?', () => {
    expect(tokensFrom('saloncontrol://auth-callback#access_token=a1&refresh_token=r1&expires_in=3600')).toEqual({
      access_token: 'a1',
      refresh_token: 'r1',
    });
    expect(tokensFrom('saloncontrol://auth-callback?access_token=a2&refresh_token=r2')).toEqual({ access_token: 'a2', refresh_token: 'r2' });
  });

  it('returns nothing for an error or a cancelled sign-in', () => {
    expect(tokensFrom('saloncontrol://auth-callback#error=access_denied')).toBeNull();
  });
});
