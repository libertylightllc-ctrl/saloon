import { hasBackend, isLocalHost } from './supabase';

describe('hasBackend', () => {
  it('uses a hosted project wherever the app runs', () => {
    expect(hasBackend('https://abc.supabase.co', 'key', 'saloon.vercel.app')).toBe(true);
    expect(hasBackend('https://abc.supabase.co', 'key', undefined)).toBe(true);
  });

  it('uses the local database only next to it (this Mac, its network, a phone via Expo)', () => {
    expect(hasBackend('auto', 'key', 'localhost')).toBe(true);
    expect(hasBackend('auto', 'key', '192.168.1.78')).toBe(true);
    expect(hasBackend('auto', 'key', undefined)).toBe(true);
  });

  it('shows "being set up" on a public address without a hosted project', () => {
    expect(hasBackend('auto', 'key', 'saloon.vercel.app')).toBe(false);
    expect(hasBackend(undefined, undefined, 'saloon.vercel.app')).toBe(false);
    expect(hasBackend('https://abc.supabase.co', undefined, 'saloon.vercel.app')).toBe(false);
  });

  it('knows local addresses', () => {
    for (const h of ['localhost', '127.0.0.1', '10.0.0.5', '172.20.1.1', 'macbook.local']) expect(isLocalHost(h)).toBe(true);
    for (const h of ['saloon.vercel.app', 'libertylightllc-ctrl.github.io', '172.32.0.1']) expect(isLocalHost(h)).toBe(false);
  });
});
