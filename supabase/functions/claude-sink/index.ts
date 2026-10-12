// Local stand-in for Claude's Messages API (the local stack's ANTHROPIC_BASE_URL), so tests never call the real API.
// Never deployed. It answers like the support assistant's structured reply: a question about passwords gets steps; one
// about refunds, or asking for a person, is handed over; anything else gets a short general answer.
Deno.serve(async (req) => {
  const body = (await req.json().catch(() => null)) as {
    model?: string;
    messages?: { role: string; content: string | { type: string; text?: string }[] }[];
  } | null;
  const last = [...(body?.messages ?? [])].reverse().find((m) => m.role === 'user');
  const text =
    typeof last?.content === 'string'
      ? last.content
      : (last?.content ?? []).map((c) => c.text ?? '').join(' ');
  const answer = /refund|person|human/i.test(text)
    ? {
        reply: 'Thanks for your message. A person from the Saloqo team will follow up here.',
        handover: true,
      }
    : /password/i.test(text)
      ? {
          reply: 'On the sign-in page tap "Forgot password?" and enter the code we email you.',
          handover: false,
        }
      : {
          reply: 'Thanks! Here is how: More → Help & support has everything you need.',
          handover: false,
        };
  console.log(`claude-sink: "${text.slice(0, 60)}" → handover ${answer.handover}`);
  return new Response(
    JSON.stringify({
      id: `msg_${crypto.randomUUID().replace(/-/g, '')}`,
      type: 'message',
      role: 'assistant',
      model: body?.model ?? 'claude-opus-5-5',
      content: [{ type: 'text', text: JSON.stringify(answer) }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
