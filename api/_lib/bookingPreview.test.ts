import { previewHtml } from './bookingPreview';

const salon = { business_name: 'Al Barsha Gents', branch_name: 'Al Barsha 1', address: 'Al Barsha 1, Dubai', logo_path: 'b1/logo.png' };

describe('booking link previews', () => {
  it('names the salon, its branch and address, with the cover photo when there is one', () => {
    const html = previewHtml('al-barsha', { ...salon, cover_path: 'b1/cover-x.jpg' }, 'https://db.example.co');
    expect(html).toContain('<meta property="og:title" content="Book at Al Barsha Gents – Al Barsha 1">');
    expect(html).toContain('content="Al Barsha 1, Dubai · Book online at Al Barsha Gents');
    expect(html).toContain('<meta property="og:image" content="https://db.example.co/storage/v1/object/public/logos/b1/cover-x.jpg">');
    expect(html).toContain('<meta property="og:url" content="https://www.saloqo.com/b/al-barsha">');
    expect(html).toContain('content="summary_large_image"');
  });

  it('uses the logo without a cover photo, and Saloqo’s own preview for an unknown link', () => {
    expect(previewHtml('al-barsha', salon, 'https://db.example.co')).toContain('public/logos/b1/logo.png');
    const unknown = previewHtml('nope', null, 'https://db.example.co');
    expect(unknown).toContain('<meta property="og:image" content="https://www.saloqo.com/og-image.jpg">');
    expect(unknown).toContain('Saloqo');
  });

  it('keeps a salon’s own words as text, never markup', () => {
    const html = previewHtml('x-salon', { ...salon, business_name: '<script>alert(1)</script>' }, 'https://db.example.co');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
