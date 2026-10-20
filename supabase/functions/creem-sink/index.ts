// Local stand-in for Creem's checkout API (the local stack's CREEM_API_BASE). Answers POST /v1/checkouts like Creem
// does, with a checkout page address that carries what was asked (product, price, request id) so tests can check it.
// Never deployed to the hosted project; there create-checkout talks to Creem.
Deno.serve(async (req) => {
  if (!req.headers.get('x-api-key')) return new Response(JSON.stringify({ message: 'no key' }), { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    product_id?: string;
    request_id?: string;
    custom_price?: number;
    success_url?: string;
    customer?: { email?: string };
  };
  const id = `ch_local_${crypto.randomUUID().slice(0, 8)}`;
  const page = new URL(`https://checkout.creem.test/${id}`);
  page.searchParams.set('product', body.product_id ?? '');
  page.searchParams.set('request', body.request_id ?? '');
  page.searchParams.set('price', String(body.custom_price ?? ''));
  page.searchParams.set('email', body.customer?.email ?? '');
  page.searchParams.set('success', body.success_url ?? '');
  return new Response(JSON.stringify({ id, object: 'checkout', mode: 'test', status: 'pending', checkout_url: page.toString() }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
