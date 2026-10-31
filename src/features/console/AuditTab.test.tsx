/** Console → Changes (final brief E2): sentences, who and when, and a line when nothing has changed yet. */
import { screen } from '@testing-library/react-native';

import { renderInApp, warmUpRendering } from '@/ui/testUtils';

import type { AuditRow } from './api';
import { AuditTab } from './AuditTab';

let mockRows: AuditRow[] = [];
jest.mock('./api', () => ({
  usePlatformAudit: () => ({ data: mockRows, isPending: false, isError: false, error: null, refetch: jest.fn() }),
}));
// The bottom sheet's animation library does not load in tests; this tab has none.
jest.mock('@/ui/BottomSheet', () => ({ BottomSheet: () => null }));

warmUpRendering();

it('says so when nothing has changed yet', async () => {
  mockRows = [];
  await renderInApp(<AuditTab />);
  expect(screen.getByText('No changes yet.')).toBeTruthy();
});

it('shows each change as a sentence, with who made it (or that it was automatic) and when', async () => {
  const base = { salon: null, subject: null, created_at: '2026-10-28T06:30:00Z' };
  mockRows = [
    { ...base, id: '1', actor: 'Haider', action: 'settings', before: { pilot_max_salons: 20 }, after: { pilot_max_salons: 15 } },
    { ...base, id: '2', actor: null, action: 'free_period:record', salon: 'Nebriix', before: { note: '7-day free trial', until: '2026-11-01' }, after: { note: '30-day free period', until: '2026-11-24' } },
  ];
  await renderInApp(<AuditTab />);
  expect(screen.getByTestId('audit-settings')).toHaveTextContent(/^Pilot places: 20 → 15Haider · 28 Oct 2026 · 10:30$/);
  expect(screen.getByTestId('audit-free_period:record')).toHaveTextContent(
    /Nebriix: free period changed from 1 Nov to 24 Nov 2026 \(30-day free period\)Automatic update · 28 Oct 2026/,
  );
  expect(screen.queryByText(/pilot_max_salons|free_period:record/)).toBeNull();
});
