/**
 * "The rest of the team" on a stylist's My bookings (owner's fix list, 16 Nov): each other person's booked times for the
 * day, as busy ranges with no client names. Touching or overlapping bookings read as one range.
 */
export interface BusySlot {
  employee_id: string | null;
  scheduled_at: string;
  duration_min: number;
}

export interface BusyRange {
  start: number;
  end: number;
}

/** Each person's busy ranges (milliseconds), merged and in order; unassigned bookings and `me` are left out. */
export function busyByPerson(slots: BusySlot[], me: string | null): Map<string, BusyRange[]> {
  const out = new Map<string, BusyRange[]>();
  const sorted = [...slots].sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  for (const slot of sorted) {
    if (!slot.employee_id || slot.employee_id === me) continue;
    const start = Date.parse(slot.scheduled_at);
    const end = start + slot.duration_min * 60_000;
    const ranges = out.get(slot.employee_id) ?? [];
    const last = ranges[ranges.length - 1];
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else ranges.push({ start, end });
    out.set(slot.employee_id, ranges);
  }
  return out;
}
