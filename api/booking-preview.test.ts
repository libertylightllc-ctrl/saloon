/**
 * @jest-environment node
 */
import { GET } from './booking-preview';

const spa = '<!DOCTYPE html><html><head><title>Saloqo</title></head><body><div id="root"></div></body></html>';

// The database as visitors see it: Red Rose's current link, and the link it used before (owner's fix list, 1 Nov).
function database(pages: Record<string, unknown>, moved: Record<string, string>) {
  return jest.fn(async (url: string, init?: { body?: string }) => {
    if (url.endsWith('/spa.html')) return new Response(spa);
    const slug = JSON.parse(init?.body ?? '{}').p_slug as string;
    if (url.endsWith('/rpc/public_booking_page')) return Response.json(pages[slug] ?? null);
    if (url.endsWith('/rpc/public_booking_link')) return Response.json(moved[slug] ?? null);
    return new Response(null, { status: 404 });
  });
}

describe('a booking link opened by a browser, Google or WhatsApp (owner’s fix list D3)', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://db.example.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  });
  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  it('an old link is sent on to the current one for good (301)', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(database({}, { 'rde-rose-beauty-parlour': 'red-rose-beauty-parlourd' }) as never);
    const response = await GET(
      new Request('https://www.saloqo.com/api/booking-preview?slug=rde-rose-beauty-parlour', { headers: { 'user-agent': 'WhatsApp/2.23' } }),
    );
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('/b/red-rose-beauty-parlourd');
  });

  it('the current link gets the page with the salon in it; a link with no page gets the page as it is', async () => {
    const red = { salon: { business_name: 'Red Rose', branch_name: 'Main', address: null, logo_path: null }, services: [] };
    jest.spyOn(global, 'fetch').mockImplementation(database({ 'red-rose-beauty-parlourd': red }, {}) as never);
    const current = await GET(new Request('https://www.saloqo.com/api/booking-preview?slug=red-rose-beauty-parlourd'));
    expect(current.status).toBe(200);
    expect(await current.text()).toContain('Book at Red Rose');
    const unknown = await GET(new Request('https://www.saloqo.com/api/booking-preview?slug=never-was-here'));
    expect(unknown.status).toBe(200);
    expect(unknown.headers.get('location')).toBeNull();
  });
});
