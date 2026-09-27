// Local stand-in for Expo's push service (the local stack's PUSH_ENDPOINT). Answers like Expo does:
// one ticket per message. Never deployed to the hosted project; there send-push talks to Expo.
Deno.serve(async (req) => {
  const messages = (await req.json().catch(() => [])) as { to?: string }[];
  const data = messages.map((m) =>
    typeof m.to === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(m.to)
      ? { status: 'ok', id: crypto.randomUUID() }
      : { status: 'error', message: 'not a push token', details: { error: 'DeviceNotRegistered' } },
  );
  return new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } });
});
