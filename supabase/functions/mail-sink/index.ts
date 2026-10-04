// Local stand-in for Resend's email API (the local stack's EMAIL_ENDPOINT). Answers like Resend does, with an id.
// Never deployed to the hosted project; there plan-alert talks to Resend.
Deno.serve(async (req) => {
  const mail = (await req.json().catch(() => null)) as { to?: string[]; subject?: string } | null;
  if (!mail?.to?.length || !mail.subject) return new Response(JSON.stringify({ message: 'missing to or subject' }), { status: 422 });
  console.log(`mail-sink: "${mail.subject}" to ${mail.to.join(', ')}`);
  return new Response(JSON.stringify({ id: crypto.randomUUID() }), { headers: { 'Content-Type': 'application/json' } });
});
