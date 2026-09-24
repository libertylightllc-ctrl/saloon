# 05 — Build plan (milestones)

Every milestone ends as a **working, connected slice**: real Supabase data, real buttons, and automated
end-to-end tests that prove it. Nothing is "done" until its tests pass.

## Rules for every milestone

- **No fake or hard-coded data** in the app. Every screen reads and writes Supabase.
- **Every visible button does its real job.** Anything not built yet is hidden — not greyed, not "coming soon".
- Every screen has **loading, empty and error** states. Buttons block double taps. Forms validate with clear
  messages. Lists have pull-to-refresh. The keyboard never covers inputs.
- **Two phones stay in sync**: a change on one shows on the other within 2 seconds (Supabase Realtime).
- Money and stock change only through RPCs (04-DATA-MODEL §7); RLS on every table; SQL tests for both.
- Demo data is seeded by **calling the real RPCs**, into a separate demo business — never a real owner's.
- `docs/PROGRESS.md` says what works, what's next and known issues. Update it as you go.

Test layers: Jest (app logic) · `npx supabase test db` (pgTAP: RLS, RPC maths, journal) ·
Playwright on Expo web (`npm run e2e`, both modes, Arabic where stated).

---

## M1 — Working core

**Scope**
- First launch: choose salon type (gents / ladies) → themed sign-in, create account, forgot password (code by
  email), with a switch to change salon type. Remembered on the device.
- Owner sign-up (Supabase Auth) → business setup wizard (mode pre-selected, changeable) → `create_business` RPC
  creates business, branch, system accounts, period, default categories, services with recipes, stock items,
  expense categories, rooms (ladies), sale counter.
- Staff / cashier logins: owner creates them (Edge Function `create-staff-login`), staff sign in with salon code +
  username + password. After sign-in the **branch's mode** sets theme and wording.
- Services & categories (with stock recipes), customers.
- Queue & appointments: walk-ins, bookings with deposit, check in / start / complete → checkout, no-show and
  cancel with deposit forfeit/refund.
- Quick sale: `create_sale` (split payments, discount, tip, VAT off/on, recipe stock deduction, journal, audit),
  receipt sharing, recent sales, sale detail, `refund_sale` (owner only).
- Home with real numbers: expected cash, sales, appointments, queue preview, revenue 7 days, payment mix,
  staff today, top services, recent activity, setup checklist.
- Settings: users & access (create, disable/enable, reset password), branch mode switch (re-themes every
  signed-in device).

**Proven by** (e2e, gents and ladies; flow 5 also in Arabic)
1. Fresh device → choose type → themed sign-in → create owner → setup → Home with real empty states.
2. Owner creates a cashier; cashier signs in in a second browser → cashier tabs only; theme follows branch.
3. Owner adds a category and a service with a recipe → appears in Quick sale.
4. Cashier adds a walk-in → owner's queue within 2 s → Start → Complete → checkout pre-filled → cash → success →
   Recent sales, Home sales & expected cash, customer visits, stock all update; journal balances.
5. Split payment and discount + tip give correct totals, VAT off and on.
6. Deposit booking → no-show → forfeited, no-show +1; another cancelled before cut-off → refunded.
7. Owner refunds with a reason; cashier cannot.
8. Owner switches branch gents → ladies → theme and wording change for every signed-in user.
9. Sign out / in, forgot password, wrong password.
10. Business A cannot see anything of business B.

## M2 — Money in / out

Inventory & tools (items, levels, movements, adjustment, count, opening stock, retail sales), purchases & suppliers
(bills with photo, weighted average cost, payments, reversals), expenses (categories, receipt photo, reversal),
cash closing (expected cash formula, denominations, variance with reason, submit/approve, lock, over/short,
cash taken out → next opening, tip payouts, history). Home gains Money out and the related Needs attention rows.

**Proven by:** receive stock → sell → level drops; bill → pay supplier → balance; cash expense lowers expected cash;
close day short by AED 5 → cashier submits → owner approves → locked, over/short posted; journal balances.

## M3 — People & rules

Staff & employees, rosters (feeding booking availability), attendance with late flags, payroll runs, adjustments,
WPS evidence, "My pay"; compliance (expiry register, hygiene log, inspection binder PDF, WPS & Montaji,
readiness %); notifications list, push (expo-notifications), daily digest (pg_cron → Edge Function);
cashier "request refund" → owner notification.

**Proven by:** clock in late → flagged; generate payroll → approve → pay → journal; document expiring → Needs
attention + notification; push token registered and a test push delivered.

## M4 — Books & finish

Accounting (overview, journal, trial balance "Balanced: Yes", close period, ledger CSV), reports with charts and
PDF/CSV export, remaining settings (tax & receipt, backup ZIP, access history, PIN quick-switch), ar/hi/ur review
and RTL pass on every screen, accessibility and performance passes, EAS builds and store submission.

**Proven by:** trial balance balances after the full e2e suite; every report exports; store builds install.

## M5 (optional) — Customer booking app

Separate app in a workspace sharing theme/UI/types: onboarding, Men/Women, home, branch detail, services, date &
time from `available_slots()`, booking summary with online deposit (payment gateway), my bookings, phone OTP.
Bookings appear in the staff queue in real time with source `app`.
