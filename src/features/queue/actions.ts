import type { Appointment } from './api';

export type RowAction = 'checkIn' | 'start' | 'complete';

/** Complete opens checkout, so it is offered only to people who can take payment. */
export function primaryAction(status: Appointment['status'], canSell = true): RowAction | null {
  if (status === 'booked') return 'checkIn';
  if (status === 'waiting') return 'start';
  if (status === 'in_progress') return canSell ? 'complete' : null;
  return null;
}
