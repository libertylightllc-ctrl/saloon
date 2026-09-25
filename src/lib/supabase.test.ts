import { resolveSupabaseUrl } from './supabase';

jest.mock('expo-constants', () => ({ expoConfig: { hostUri: '192.168.1.78:8081' } }));

describe('resolveSupabaseUrl', () => {
  it('uses a configured hosted URL as is', () => {
    expect(resolveSupabaseUrl('https://abc.supabase.co/', undefined, undefined)).toBe('https://abc.supabase.co');
  });

  it('follows the dev server host on a phone', () => {
    expect(resolveSupabaseUrl('auto', '192.168.1.78:8081', undefined)).toBe('http://192.168.1.78:54321');
    expect(resolveSupabaseUrl(undefined, '10.0.0.5:8081', undefined)).toBe('http://10.0.0.5:54321');
  });

  it('follows the page host on web', () => {
    expect(resolveSupabaseUrl('auto', undefined, 'localhost')).toBe('http://localhost:54321');
  });

  it('gives up when there is nothing to go on', () => {
    expect(resolveSupabaseUrl('auto', undefined, undefined)).toBeNull();
  });
});
