import { signUpOutcome } from './api';

describe('signUpOutcome', () => {
  it('signs in straight away when a session comes back (email confirmation off)', () => {
    expect(signUpOutcome({ session: {}, user: { identities: [{}] } })).toBe('signed_in');
  });

  it('asks to check the inbox when confirmation is on', () => {
    expect(signUpOutcome({ session: null, user: { identities: [{}] } })).toBe('check_email');
  });

  it('says the address already has an account (Supabase returns a user with no identities)', () => {
    expect(signUpOutcome({ session: null, user: { identities: [] } })).toBe('already_registered');
  });
});
