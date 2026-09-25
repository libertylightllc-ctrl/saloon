# Progress

Updated: 2026-09-25

## Current milestone: M1 — Working core (in progress)

### Works (proven)
- **Database** (`supabase/migrations/…01–09`): tenancy, ledger (balanced-journal constraint, closed periods),
  catalogue, queue & sales, all money/stock RPCs, RLS on every table, realtime publication.
  57 SQL tests pass (`npx supabase test db`).
- **Edge Functions**: `create-staff-login`, `manage-staff-login` (reset password, disable/enable).
- **Seed**: two demo businesses built through the real RPCs (`supabase/seed.sql`).
- **App screens on real data**: welcome → sign-in/sign-up/forgot → setup wizard; Home, Queue, New walk-in/booking,
  Quick sale + checkout + receipt, Customers (list/profile/form), Services (list/form with recipe/categories),
  Sales (list/detail/refund), More, Team & logins, Branch settings (mode switch, VAT, rules, opening cash).
- **Checks**: `npx tsc --noEmit`, `npx eslint .`, `npx jest` (109 tests) all clean.
- **E2E (Playwright, `npx playwright test`)** passing in gents and ladies:
  1 onboarding · 2 staff logins & role tabs · 3 service with recipe → Quick sale ·
  4 walk-in syncs < 2 s → start → complete → checkout → cash, with Home/customer/stock/journal checks.

### Next
- E2E flows 5–10 (split/discount/tip/VAT incl. Arabic; deposits; refunds; mode switch live; auth; isolation).
- Button sweep in both modes; hosted Supabase switch notes; hand-over report + phone script; commit.

### Bugs found by the e2e run and fixed
- `available_slots` looped forever when closing time was near midnight (time wrap). Rewritten in minutes;
  overnight hours (18:00 → 02:00) supported; returns `starts_at`.
- `create_sale` failed through the API: `pg_safeupdate` refuses UPDATE without WHERE (temp table).
  Fixed, and a Jest test now scans every migration for this.
- Forms inside bottom sheets crashed (`useToast` outside provider) — provider order fixed.
- `accessibilityState` did not reach the web DOM; switched to `aria-*` props (screen readers on web).

### Known issues
- None open.

### How to resume
Start a new session with: `Continue M1 from docs/PROGRESS.md`.
Local stack: `npx supabase start`, then `npx expo start --web --port 8081` (Playwright reuses it).
