# M1 hand-over — Working core

Date: 2026-09-25 · Branch: `main` · Local stack (Supabase in Docker on this Mac)

## What was built
- **Sign-in by salon type**: welcome with two cards (the choice re-themes and is remembered), themed sign-in /
  create account / forgot password (6-digit code by email), switch to change type, clear messages for wrong
  password, no connection, slow server and disabled logins. Sign-out returns to the themed sign-in.
- **Owner setup wizard**: business, country, salon type (pre-selected, changeable), branch and hours, VAT and
  opening cash, all through one `create_business` call.
- **Staff logins**: the owner creates cashier/staff/accountant logins; staff sign in with salon code + username +
  password; the branch's type sets theme and wording (Barber/Stylist); disable/enable and reset password.
- **Queue & bookings**: walk-ins, bookings with deposit, live on every phone (under 2 s), start → complete →
  checkout pre-filled, no-show keeps the deposit, early cancel refunds it.
- **Quick sale**: split payment, discount, tip, VAT off/on, recipe stock deduction, receipt (share as PDF on phones,
  print on web), recent sales, sale detail, owner-only refunds with a reason.
- **Customers, services (with recipes), categories, Home with real numbers, Team & logins, Branch settings**
  (type switch re-themes every signed-in phone live).
- **Owner's books (owner request)**: More → Accounts & history — how today's expected cash is made up, this month's
  revenue/costs/result/VAT/tips, journal, trial balance ("Balanced: Yes"), history (activity + sign-ins). Owner and
  accountant only.
- **Languages**: English, Arabic, Hindi, Urdu; right-to-left for Arabic/Urdu; dates in the app language with 0-9 digits.

## How it is proven
| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | clean |
| Lint | `npx eslint .` | clean |
| App tests | `npx jest` | 136 / 136 |
| Database tests | `npx supabase test db` | 70 / 70 |
| Database health | `supabase/checks/health.sql` | 27 tables with row level security, 12 integrity checks, 0 problems |
| E2E flows 1–11 + 13 (owner's books), gents + ladies (flow 5 also Arabic) | `npx playwright test --grep-invert @sweep` | 3 runs in a row on the final commit: 34/34, 34/34, 34/34, no retries |
| Flow 9 repeated | `npx playwright test e2e/09-auth.spec.ts --repeat-each=30` | 120 / 120 on the final commit |
| Button sweep, both modes, owner/cashier/staff | `npx playwright test --grep @sweep` | 753 taps, 0 failures — `docs/button-sweep/` |

## Real bugs the tests caught (all fixed and covered by tests; the session, sign-up-race and toast tests were run against the old code and fail there)
1. Booking slots froze the server for branches closing near midnight; overnight hours now work.
2. Every sale failed through the API (database guard against UPDATE without WHERE).
3. A slow membership load after sign-out put the phone back into the previous salon (shared-phone leak).
4. Password reset signed the phone in before the new password was saved.
5. Sign-up hung after 100 salons with the same name prefix; simultaneous sign-ups collided; a double submit made two salons.
6. Offline sign-in spun forever; sign-out could be undone by closing the app.
7. Back did nothing on a refreshed/deep-linked screen; web "Print receipt" printed the screen instead of the receipt.
8. Staff without payment rights were offered checkout; hidden tabs could be opened by address.
9. A quick second confirmation (e.g. "Marked … as no-show" right after "Booked …") was wiped by the first toast's timer.
10. Cashiers could read the full history; app roles held TRUNCATE on every table (ignores row level security).

## Open items (not blockers for M1)
- Other-language text is machine-drafted (`_review` flag in ar/hi/ur) — needs a native speaker's pass.
- Ladies buttons keep `#E0606A` (white text 3.5:1, below 4.5:1) as the spec chose — needs your sign-off.
- Hosted Supabase not set up yet — see `docs/HOSTED-SUPABASE.md` (you create the project and send two public values).

## Test on two phones
`docs/PHONE-TEST.md` — a 10-minute script for one owner phone and one cashier phone.
