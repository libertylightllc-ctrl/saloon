// Local stand-in for the support assistant's AI (the local stack's GROQ_BASE_URL and ANTHROPIC_BASE_URL), so tests
// never call a real API. Never deployed. It answers Groq's OpenAI-style chat completions and Claude's Messages API
// with the assistant's structured reply: a question about passwords gets steps; one about refunds, or asking for a
// person, is handed over; anything else gets a short general answer.
type Turn = { role: string; content: string | { type: string; text?: string }[] };

Deno.serve(async (req) => {
  const body = (await req.json().catch(() => null)) as { model?: string; messages?: Turn[] } | null;
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
  const openai = new URL(req.url).pathname.endsWith('/chat/completions');
  console.log(
    `ai-sink (${openai ? 'groq' : 'claude'}): "${text.slice(0, 60)}" → handover ${answer.handover}`,
  );
  const reply = openai
    ? {
        id: `chatcmpl-${crypto.randomUUID()}`,
        object: 'chat.completion',
        model: body?.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: JSON.stringify(answer) },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }
    : {
        id: `msg_${crypto.randomUUID().replace(/-/g, '')}`,
        type: 'message',
        role: 'assistant',
        model: body?.model,
        content: [{ type: 'text', text: JSON.stringify(answer) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      };
  return new Response(JSON.stringify(reply), { headers: { 'Content-Type': 'application/json' } });
});
