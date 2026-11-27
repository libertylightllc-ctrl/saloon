import { i18n, initI18n } from '@/lib/i18n';

import { fillReply, needsReason, replyLine, spanText, stageCounts } from './stage';

beforeAll(async () => {
  await initI18n('en');
});
const t = (...a: Parameters<typeof i18n.t>) => i18n.t(...a);

it('counts the conversations in each status', () => {
  expect(stageCounts([{ stage: 'waiting_team' }, { stage: 'waiting_team' }, { stage: 'closed' }])).toEqual({
    waiting_team: 2,
    new: 0,
    waiting_salon: 0,
    solved: 0,
    closed: 1,
  });
});

it('asks for a reason only while nobody has answered the last message', () => {
  expect(needsReason('waiting_team', 'solved')).toBe(true);
  expect(needsReason('new', 'closed')).toBe(true);
  expect(needsReason('waiting_salon', 'solved')).toBe(false);
  expect(needsReason('solved', 'closed')).toBe(false);
  expect(needsReason('closed', 'waiting_team')).toBe(false);
});

it('says how long in minutes, hours or days', () => {
  expect(spanText(t as never, 45)).toBe('45 min');
  expect(spanText(t as never, 135)).toBe('2 h 15 min');
  expect(spanText(t as never, 3 * 24 * 60 + 5)).toBe('3 days');
  expect(spanText(t as never, 24 * 60)).toBe('1 day');
});

it('shows the first reply, or how long it has waited for one', () => {
  const now = new Date('2026-11-27T12:00:00Z').getTime();
  expect(
    replyLine(t as never, { stage: 'waiting_salon', stage_at: '2026-11-27T10:00:00Z', first_asked_at: '2026-11-27T08:00:00Z', first_reply_at: '2026-11-27T10:15:00Z' }, now),
  ).toEqual(['First reply: 2 h 15 min']);
  expect(
    replyLine(t as never, { stage: 'waiting_team', stage_at: '2026-11-24T11:00:00Z', first_asked_at: '2026-11-24T10:58:00Z', first_reply_at: null }, now),
  ).toEqual(['No reply yet', 'Waiting 3 days']);
});

it('fills a saved reply with the name and salon, and reads cleanly without them', () => {
  expect(fillReply('Hi {name}, thanks for writing from {salon}.', { name: 'Layla', salon: 'Palm Salon' })).toBe(
    'Hi Layla, thanks for writing from Palm Salon.',
  );
  expect(fillReply('Hi {name}, we are on it.', { name: null })).toBe('Hi, we are on it.');
});
