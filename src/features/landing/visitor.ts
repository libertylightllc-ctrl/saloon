/**
 * Where the visitor is, for the home page: the UAE price and the UAE-only lines for a visitor in the UAE, the
 * international ones elsewhere — by IP (2026-10-12), or by the device's time zone when that cannot be told.
 */
import { useQuery } from '@tanstack/react-query';

import { deviceTimeZone } from '@/features/setup/CountryStep';
import { countryOf } from '@/lib/countries';
import { visitorCountry } from '@/lib/geo';

export function inUae(country: string | null | undefined): boolean {
  if (country) return country === 'AE';
  const zone = deviceTimeZone();
  return zone !== null && (countryOf('AE')?.timezones.includes(zone) ?? false);
}

/** In the UAE (true / false), or null while it is still being found out. */
export function useVisitorInUae(): boolean | null {
  const where = useQuery({ queryKey: ['visitor-country'], queryFn: () => visitorCountry(), staleTime: Infinity });
  return where.isPending ? null : inUae(where.data);
}
