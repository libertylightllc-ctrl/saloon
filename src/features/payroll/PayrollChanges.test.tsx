/**
 * Payroll since the work-out (owner's app check A1, 9 Nov 2026): the screen says when it was worked out, how many
 * changes came after (1 change, not "1 changes"), and on an approved month the commission it missed and for whom.
 */
import { screen } from '@testing-library/react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import type { PayrollChanges } from './api';
import { PayrollChangesNote } from './PayrollChanges';

const base: PayrollChanges = { generated_at: '2026-10-25T20:45:00Z', stale: false, changes: 0, missed: [], missed_minor: 0 };

// The shared UI's bottom sheet needs native animation modules the test renderer lacks.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

it('up to date: only when it was worked out (in the salon’s time)', async () => {
  await renderInApp(<PayrollChangesNote changes={base} timezone="Asia/Qatar" />);
  expect(screen.getByTestId('payroll-worked-out')).toHaveTextContent('Worked out 25 Oct, 23:45');
  expect(screen.queryByTestId('payroll-stale')).toBeNull();
  expect(screen.queryByTestId('payroll-missed')).toBeNull();
});

it.each([
  [1, '1 change since this was worked out. Work it out again before approving.'],
  [3, '3 changes since this was worked out. Work it out again before approving.'],
  [0, 'Pay details changed since this was worked out. Work it out again before approving.'],
])('out of date with %i changes: says so, one as one', async (count, text) => {
  await renderInApp(<PayrollChangesNote changes={{ ...base, stale: true, changes: count }} timezone="Asia/Qatar" />);
  expect(screen.getByTestId('payroll-stale')).toHaveTextContent(text);
});

it('an approved month names the commission it missed', async () => {
  await renderInApp(
    <PayrollChangesNote
      changes={{ ...base, missed: [{ employee_id: 'e1', full_name: 'Yasmin', commission_minor: 1400 }], missed_minor: 1400 }}
      timezone="Asia/Qatar"
    />,
  );
  expect(screen.getByTestId('payroll-missed')).toHaveTextContent(/Commission from sales after 25 Oct, 23:45 isn't included \(.*14\.00\)/);
  expect(screen.getByText(/^Yasmin: .*14\.00$/)).toBeTruthy();
});
