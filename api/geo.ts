/**
 * The visitor's country (two letters, e.g. "AE") for the website's language and price (owner, 2026-10-12). Vercel puts
 * it on every request it serves; nothing about the visitor is stored. Null when unknown.
 */
export function GET(request: Request): Response {
  const country = request.headers.get('x-vercel-ip-country');
  return Response.json(
    { country: country && /^[A-Z]{2}$/.test(country) ? country : null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
