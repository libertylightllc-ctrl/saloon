# M3 hand-over — People & rules

Date: 2026-09-28 · Branch: `main` · Local stack (Supabase in Docker on this Mac)

## What was built
- **Staff & payroll** (More): everyone who works here with job, employee ID, base salary, commission %, WPS and phone.
  Salaries are visible only to you and the accountant. Add people who have no app login; logins stay in Team & logins.
- **Weekly rosters**: one shift per weekday per person. Booking slots now follow them: a named barber/stylist can
  only be booked inside their shift, and "any" needs someone rostered.
- **Attendance**: staff and cashiers clock in/out from Home; the owner or cashier records others with the real time
  ("Rafiq came at 09:20"). Late = more than the grace minutes after the shift start (Branch settings, default 10).
  A board per day shows who is in, late, done or off.
- **Payroll**: bonuses, deductions and advances (a cash advance leaves the drawer and lowers expected cash). The month
  is worked out as a draft, approved (posted to the books), then paid per person by cash or bank. Commission leaves
  out refunded sales; advances are paid back from the salary and carry over if it is not enough. WPS salaries need
  the bank-transfer proof. Staff see their own payslips, commission and advances on a new **My pay** tab.
- **Compliance** (More): the expiry register fills from the UAE template — for the salon a trade licence, Ejari,
  pest control and civil defence certificate; for each staff member a health card, visa and vaccination record —
  plus your own records. Statuses: valid, due soon, expired, scan missing, date missing, missing. Renewing keeps the
  old version. Readiness %, a daily **hygiene log** (the cashier signs it; a photo can be made compulsory),
  **inspection binder** with PDF export, **WPS & Montaji** (numbers on inventory items).
- **Notifications**: a bell with the unread count on Home and a list in the app's language, for new bookings,
  walk-ins waiting too long, closes to approve, items running low, documents due in 30/7/0 days, payroll worked out
  and refund requests, plus the **08:00 daily digest** for the owner. Phones get the same as **push**.
- **Refund requests**: a cashier asks for a refund on a sale; you get a notification, see the request on the sale,
  and refund or decline it.
- **Home** also asks for: payroll to approve, missing WPS proofs, compliance records needing attention, today's
  hygiene log.
- **Demo salons**: pay terms, rosters, two weeks of attendance, last month's paid payroll, this month's advance and
  bonus, compliance records (some due, one expired) and a week of hygiene logs.

## How it is proven
| Check | Command | Result |
|---|---|---|
| Type check / lint | `npx tsc --noEmit` · `npx eslint .` | clean |
| App tests | `npx jest` | 157 / 157 |
| Database tests | `npx supabase test db` | 361 / 361 (M3: staff & attendance 32, payroll 42, compliance 30, notifications 30) |
| Database health | `supabase/checks/health.sql` | 26 integrity checks, 0 problems; both demo salons balanced |
| E2E, gents + ladies | `npx playwright test --grep-invert @sweep` | 112 / 112 in 3 runs in a row (2026-09-30, commit ad3a182; 25, 24 and 25 min; no live-update drops) |
| Button sweep (every screen incl. M3), owner/cashier/staff | `npx playwright test --grep @sweep` | 6 / 6 — 1871 buttons in both modes for owner, cashier, staff and accountant, 0 without a visible effect (docs/button-sweep/) |

The build plan's M3 checks, each an automated test in both modes: clock in late → flagged (flow 20); generate payroll →
approve → pay → journal (21); document expiring → Needs attention (22) and a notification (SQL: 30/7/0 days); push token
registered and a test push delivered by the every-minute job (23).

## Open items
- **Push on real phones** needs the EAS project id that store/development builds have (M4, EAS). Expo Go on Android no
  longer receives remote push. Until then push is proven locally against a stand-in for Expo's service.
- Push messages are in English (the server does not yet know each phone's language); the in-app list is translated.
- Hosted Supabase still not set up (`docs/HOSTED-SUPABASE.md`; never send the service_role key or the database
  password). When it is, I also run `configure_push` with the project URL and the public anon key.
- Arabic, Hindi and Urdu text for M3 is machine-drafted (needs a native speaker's pass).

## Test on two phones
`docs/PHONE-TEST.md` — steps 14–17 cover M3 (roster and clock-in, payroll, compliance, notifications).
