import { busyByPerson } from './busyRanges';

const at = (hhmm: string) => `2026-11-16T${hhmm}:00Z`;

describe('the rest of the team (owner fix list, 16 Nov)', () => {
  it('gives each other person their busy ranges, merged, without me or unassigned bookings', () => {
    const busy = busyByPerson(
      [
        { employee_id: 'sara', scheduled_at: at('11:00'), duration_min: 30 },
        { employee_id: 'sara', scheduled_at: at('10:00'), duration_min: 45 },
        { employee_id: 'sara', scheduled_at: at('10:30'), duration_min: 30 },
        { employee_id: 'me', scheduled_at: at('09:00'), duration_min: 60 },
        { employee_id: null, scheduled_at: at('09:30'), duration_min: 30 },
        { employee_id: 'lina', scheduled_at: at('12:00'), duration_min: 60 },
      ],
      'me',
    );
    expect([...busy.keys()].sort()).toEqual(['lina', 'sara']);
    expect(busy.get('sara')).toEqual([
      { start: Date.parse(at('10:00')), end: Date.parse(at('11:30')) },
    ]);
    expect(busy.get('lina')).toEqual([{ start: Date.parse(at('12:00')), end: Date.parse(at('13:00')) }]);
  });

  it('keeps separate bookings apart', () => {
    const busy = busyByPerson(
      [
        { employee_id: 'sara', scheduled_at: at('10:00'), duration_min: 30 },
        { employee_id: 'sara', scheduled_at: at('14:00'), duration_min: 60 },
      ],
      'me',
    );
    expect(busy.get('sara')).toHaveLength(2);
  });
});
