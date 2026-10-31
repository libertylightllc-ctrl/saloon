/** The fields of a plan event (Console → Plans) that tell a repeated request. */
interface PlanEventLike {
  business_id: string;
  kind: string;
  months: number | null;
  created_at: string;
}

export type MergedPlanEvent<T> = T & { repeats: number; first_at: string };

/**
 * Console → Plans, newest first, with a request sent again folded into one row (final brief E3): the same salon asking
 * for the same months again before anything was paid or ended (Asil Trims asked twice, 26 seconds apart, before the
 * database refused a second request). The row is the latest one, with how many times it was sent and when first.
 * Nothing is removed from the records.
 */
export function mergeRepeatRequests<T extends PlanEventLike>(rows: T[]): MergedPlanEvent<T>[] {
  const out: MergedPlanEvent<T>[] = [];
  const waiting = new Map<string, MergedPlanEvent<T>>();
  for (const e of [...rows].reverse()) {
    if (e.kind === 'activate' || e.kind === 'end') waiting.delete(e.business_id);
    const before = e.kind === 'request' ? waiting.get(e.business_id) : undefined;
    const row: MergedPlanEvent<T> =
      before && before.months === e.months ? { ...e, repeats: before.repeats + 1, first_at: before.first_at } : { ...e, repeats: 1, first_at: e.created_at };
    if (before && row.repeats > 1) out.splice(out.indexOf(before), 1);
    if (e.kind === 'request') waiting.set(e.business_id, row);
    out.push(row);
  }
  return out.reverse();
}
