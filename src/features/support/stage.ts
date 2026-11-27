/**
 * A support conversation's status in the console (owner's brief, Part E1, 27 Nov 2026; migration 123): what each is
 * called, its colour, the order the inbox lists them in, how long someone has waited and how long the first reply by
 * a person took. Pure, so it is tested on its own.
 */
import type { TFunction } from 'i18next';

import { formatDuration } from '@/lib/duration';
import type { Tone } from '@/theme';

export const STAGES = ['waiting_team', 'new', 'waiting_salon', 'solved', 'closed'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_TONE: Record<Stage, Tone> = {
  waiting_team: 'error',
  new: 'primary',
  waiting_salon: 'info',
  solved: 'success',
  closed: 'neutral',
};

export interface StageRow {
  stage: Stage;
  stage_at: string;
  first_asked_at: string | null;
  first_reply_at: string | null;
}

export function stageCounts(rows: { stage: Stage }[]): Record<Stage, number> {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const r of rows) counts[r.stage] += 1;
  return counts;
}

/** Solved or Closed while nobody has answered the salon's last message needs a reason (the database checks it too). */
export function needsReason(from: Stage, to: Stage): boolean {
  return (to === 'solved' || to === 'closed') && (from === 'new' || from === 'waiting_team');
}

const minutes = (from: string, to: number) => Math.max(0, (to - new Date(from).getTime()) / 60_000);

/** "45 min", "2 h 15 min" under a day; "3 days" from a day on. */
export function spanText(t: TFunction, mins: number): string {
  if (mins < 24 * 60) return formatDuration(t, mins);
  return t('console.pilot.codeDays', { count: Math.floor(mins / (24 * 60)) });
}

/**
 * Under a conversation: the first reply by a person ("First reply: 2 h 15 min", or "No reply yet"), and how long it
 * has waited for one when it is Waiting for you ("Waiting 3 days").
 */
export function replyLine(t: TFunction, r: StageRow, now = Date.now()): string[] {
  const parts: string[] = [];
  if (r.first_reply_at && r.first_asked_at) {
    parts.push(t('console.support.firstReplyIn', { time: spanText(t, minutes(r.first_asked_at, new Date(r.first_reply_at).getTime())) }));
  } else if (r.first_asked_at) {
    parts.push(t('console.support.noReplyYet'));
  }
  if (r.stage === 'waiting_team') parts.push(t('console.support.waitingFor', { time: spanText(t, minutes(r.stage_at, now)) }));
  return parts;
}

/** A saved reply with the person's name and salon filled in ({name}, {salon}); an unknown one is left out cleanly. */
export function fillReply(template: string, v: { name?: string | null; salon?: string | null }): string {
  return template
    .replace(/\{name\}/g, v.name?.trim() || '')
    .replace(/\{salon\}/g, v.salon?.trim() || '')
    .replace(/[ \t]+([,.!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
