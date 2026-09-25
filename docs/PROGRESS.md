# Progress

Updated: 2026-09-25

## Current milestone: M1 — Working core ✅ done (hand-over: docs/M1-HANDOVER.md). Next: M2 — Money in / out

### Works (proven)
- **Database** (`supabase/migrations/…01–09`): tenancy, ledger (balanced-journal constraint, closed periods),
  catalogue, queue & sales, all money/stock RPCs, RLS on every table, realtime publication.
  70 SQL tests (`npx supabase test db`), 136 app tests (`npx jest`), integrity check `supabase/checks/health.sql`.
- **Edge Functions**: `create-staff-login`, `manage-staff-login` (reset password, disable/enable).
- **Seed**: two demo businesses built through the real RPCs (`supabase/seed.sql`, local only).
- **App screens on real data**: welcome → sign-in/sign-up/forgot → setup wizard; Home, Queue, New walk-in/booking,
  Quick sale + checkout + receipt, Customers (list/profile/form), Services (list/form with recipe/categories),
  Sales (list/detail/refund), More, Team & logins, Branch settings (mode switch, VAT, rules, opening cash).
- **Owner's books**: More → Accounts & history (cash calculation, month result, journal, trial balance, history).
- **Languages**: en/ar/hi/ur, RTL for ar/ur; day and month names follow the language, digits stay 0-9.
- **App checks**: `npx tsc --noEmit`, `npx eslint .`, `npx jest` all clean.
- **E2E (`npx playwright test --grep-invert @sweep`)**: flows 1–10 from the build plan plus 11 (sign-up races),
  plus 13 (owner's books), each in gents and ladies; flow 5 also in Arabic. 3 runs in a row on the final commit, 34/34 each.
  Flow 9 repeated 30× in both modes (120/120). Button sweep: 753 taps, both modes, owner/cashier/staff, 0 failures.

### Bugs found by the e2e work and fixed
- `available_slots` looped forever when closing near midnight; overnight hours now supported.
- `create_sale` failed through the API (UPDATE without WHERE under pg_safeupdate); a Jest test scans migrations.
- Session: a late membership load after sign-out (or the next person's sign-in) put the device back into the
  previous salon. Loads are now generation-checked; unit tests fail on the old code.
- Password reset signed the device in before the new password was saved (detached client now).
- Salon codes ran out after 100 salons with the same name prefix (sign-up then hung); two simultaneous sign-ups
  could collide on a code; one owner sending setup twice could get two salons. All fixed, with tests.
- Offline sign-in spun forever; sign-out could be undone by closing the app; forms in sheets crashed; web
  accessibility state; Back did nothing on a refreshed/deep-linked screen; web "Print receipt" printed the screen
  instead of the receipt; sheets were not modal for screen readers; staff were offered checkout; a quick second
  toast was wiped by the first one's timer.

### Next
- M2 — Money in / out (see 05-BUILD-PLAN.md). Owner actions before real use: hosted Supabase
  (docs/HOSTED-SUPABASE.md), native-speaker review of ar/hi/ur, sign-off on the ladies button contrast.

### Known issues
- None open in M1 scope.

### How to resume
Start a new session with: `Start M2 from docs/PROGRESS.md`.
Local stack: `colima start --cpu 4 --memory 6`, `npx supabase start`, then `npx expo start --web --port 8081`
(Playwright reuses it). Keep ~10 GB free on the Mac: a full disk stops the Docker VM.
