import { cardTree, drawable } from './bookingCard';
import { english, previewHtml, previewMeta, withPreview, type PreviewPage } from './bookingPreview';

const salon = { business_name: 'Al Barsha Gents', branch_name: 'Al Barsha 1', address: 'Shop 4, Al Barsha 1, Dubai', logo_path: 'b1/logo.png' };
const page = (s: Partial<PreviewPage['salon']> = {}, services = 12): PreviewPage => ({
  salon: { ...salon, ...s },
  services: Array.from({ length: services }, (_, i) => ({ id: i })),
});
const db = 'https://db.example.co';
const spa = `<!DOCTYPE html><html lang="en"><head>
<title>Saloqo</title>
<meta name="description" content="Saloqo runs a barber shop" />
<link rel="canonical" href="https://www.saloqo.com/" />
<meta property="og:title" content="Saloqo · Run your salon from your phone" />
<meta property="og:image" content="https://www.saloqo.com/og-image.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#6C45F2" />
</head><body><div id="root"></div></body></html>`;

describe('booking link previews (owner’s fix list D1)', () => {
  it('names the salon and its town, counts its services, and shows its logo on a Saloqo card', () => {
    const meta = previewMeta('al-barsha', page(), db);
    expect(meta.title).toBe('Book at Al Barsha Gents – Dubai');
    expect(meta.description).toBe('12 services · book online, no app needed');
    expect(meta.url).toBe('https://www.saloqo.com/b/al-barsha');
    expect(meta.image).toMatch(/^https:\/\/www\.saloqo\.com\/api\/booking-card\?slug=al-barsha&v=[0-9a-z]+$/);
  });

  it('a new logo or name gets a new picture address; one service is "1 service"', () => {
    const before = previewMeta('al-barsha', page(), db).image;
    expect(previewMeta('al-barsha', page({ logo_path: 'b1/logo-2.png' }), db).image).not.toBe(before);
    expect(previewMeta('al-barsha', page({ business_name: 'Barsha Cuts' }), db).image).not.toBe(before);
    expect(previewMeta('al-barsha', page({}, 1), db).description).toBe('1 service · book online, no app needed');
  });

  it('without a logo: the cover photo, else Saloqo’s card; without an address: the branch says where', () => {
    expect(previewMeta('x', page({ logo_path: null, cover_path: 'b1/cover.jpg' }), db).image).toBe(
      'https://db.example.co/storage/v1/object/public/logos/b1/cover.jpg',
    );
    expect(previewMeta('x', page({ logo_path: null }), db).image).toBe('https://www.saloqo.com/og-image.jpg');
    expect(previewMeta('x', page({ address: null }), db).title).toBe('Book at Al Barsha Gents – Al Barsha 1');
    expect(previewMeta('x', page({ address: null, branch_name: 'Al Barsha Gents' }), db).title).toBe('Book at Al Barsha Gents – Saloqo');
  });

  it('an unknown or switched-off link gets Saloqo’s own preview', () => {
    const meta = previewMeta('nope', null, db);
    expect(meta.image).toBe('https://www.saloqo.com/og-image.jpg');
    expect(meta.title).toContain('Saloqo');
  });

  it('swaps the app page’s general tags for the salon’s, keeping everything else', () => {
    const html = withPreview(spa, previewMeta('al-barsha', page(), db));
    expect(html).not.toContain('Run your salon from your phone');
    expect(html).not.toContain('<title>Saloqo</title>');
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/property="og:image"/g)).toHaveLength(1);
    expect(html).toContain('<meta property="og:title" content="Book at Al Barsha Gents – Dubai">');
    expect(html).toContain('<link rel="canonical" href="https://www.saloqo.com/b/al-barsha">');
    expect(html).toContain('<meta name="theme-color" content="#6C45F2" />');
    expect(html).toContain('<div id="root"></div>');
  });

  it('keeps a salon’s own words as text, never markup or a replacement pattern', () => {
    const html = withPreview(spa, previewMeta('x-salon', page({ business_name: '<script>alert(1)</script> $& Co' }), db));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; $&amp; Co');
    expect(previewHtml(previewMeta('x', null, db))).toContain('href="https://www.saloqo.com/b/x?app=1"');
  });

  it('reads English texts by key, with the "_one" form for 1', () => {
    expect(english('meta.booking.services', { count: 3 })).toBe('3 services · book online, no app needed');
    expect(english('meta.booking.card')).toBe('Book online · no app needed');
  });
});

describe('the preview card', () => {
  it('draws Latin names and towns; leaves off text its fonts cannot join', () => {
    expect(drawable('Al Barsha Gents & Co.')).toBe('Al Barsha Gents & Co.');
    expect(drawable('Café Élan')).toBe('Café Élan');
    expect(drawable('صالون الورد')).toBeNull();
    expect(drawable('सैलून')).toBeNull();
    expect(drawable('  ')).toBeNull();
    const text = JSON.stringify(cardTree({ logo: 'data:image/png;base64,AA', name: 'صالون', place: 'Dubai', action: 'Book online · no app needed', site: 'saloqo.com' }));
    expect(text).not.toContain('صالون');
    expect(text).toContain('Dubai');
    expect(text).toContain('data:image/png;base64,AA');
  });
});
