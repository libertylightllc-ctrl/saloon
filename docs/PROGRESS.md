# Progress

Updated: 2026-09-30

## Current milestone: M4 — Books & finish. M3 ✅ built (hand-over: docs/M3-HANDOVER.md), M2 ✅ done

### M4 status
- ✅ Books — close month (owner; books must balance; reopen with a reason), ledger CSV. SQL `11_books_reports.test.sql`.
- ✅ Reports — monthly business, staff sales, daily closing, stock movement, cash shortage, customer list; month picker,
  figures, chart, table, print / PDF / CSV, owner control line; accountant tabs Reports and Accounting. e2e flow 24.
- ✅ Settings — customer receipt (none / print / WhatsApp), backup ZIP, PIN quick-switch (SQL `12_quick_switch`,
  e2e flow 25). Access history was already in Accounts & history.
- ✅ Performance — access checks once per query (SQL `13_rls_shape`), paged virtual customer list, reports and
  exports read past 1,000 rows; e2e flow 26 (1,200 customers).
- ✅ Languages — 23 screens in Arabic, Urdu, Hindi: direction, no raw keys, nothing wider than the phone (flow 27).
  Texts remain machine drafts for a native speaker to review.
- ✅ Store builds prepared — `eas.json`, `app.config.ts`, `docs/STORE-RELEASE.md`. Building needs the owner's
  Expo / Apple / Google accounts.
- ✅ Owner feedback (2026-09-30) — optional service time, staff name on sales and receipts, show password, VAT on
  bills and expenses, VAT report (SQL `15_feedback_vat`, e2e flow 30); panels reopen after a tap outside (flow 31).
- ✅ Launch items (2026-09-30) — purchase entry in the invoice format (packs, unit price, VAT 5% per line, subtotal /
  VAT / grand total / paid / supplier balance, PUR-00001, Print / PDF), pack sizes; privacy policy and terms;
  Delete my account (closes the salon for an owner); phone apps show the plan without selling it; installable
  website with a real app icon. SQL `16_launch_purchases`, e2e flow 32.
- ✅ One person, one staff record (2026-09-30): a login joins the person's Staff & payroll record (Create login on
  their page, or pick them in Team & logins); earlier duplicates merged. SQL `17_one_person_one_record`, e2e flow 33.
- ✅ Proof (2026-09-30, ad3a182) — full suite 112 / 112 three runs in a row, button sweep 6 / 6 (1871 buttons, 0 dead): docs/M4-HANDOVER.md.


### M3 status
- ✅ Staff & attendance — 2026-09-28: staff list with pay terms (owner/accountant only), add people without a login,
  weekly rosters that booking slots follow, attendance board, clock in/out from Home with a late flag, owner and
  cashier record for others. SQL `06_staff_attendance.test.sql` (32), e2e `20-staff-attendance.spec.ts` (both modes).
- ✅ Payroll — 2026-09-28: bonuses, deductions and advances (cash advances leave the drawer), month worked out →
  approved (posted) → paid by cash or bank, commission less refunds, advances recovered, WPS proof, My pay tab for
  staff, Home asks for approval and missing WPS proofs. SQL `07_payroll.test.sql` (42), e2e `21-payroll.spec.ts`.
- ✅ Compliance — 2026-09-28: expiry register from the UAE template with statuses, versions (renew) and scans,
  owner's own records, readiness %, hygiene log (cashier signs; photo can be required), inspection binder PDF,
  WPS & Montaji, Home asks for what is missing and for today's hygiene log. SQL `08_compliance.test.sql` (30),
  e2e `22-compliance.spec.ts` (both modes).
- ✅ Notifications — 2026-09-28: bell with unread count, list in the app language, mark all read, tap to open;
  events for bookings, long waits, closes, low stock, documents due 30/7/0, payroll, refund requests; 08:00 daily
  digest; push tokens and delivery through send-push (pg_cron every minute, proven locally with the push-sink
  stand-in); cashier "request refund". SQL `09_notifications.test.sql` (30), e2e `23-notifications.spec.ts`.
- ✅ M3 hand-over: `docs/M3-HANDOVER.md`. Its 3-in-a-row proof is part of M4's (the suite includes every M3 flow).

### M2 status
- ✅ Expenses (16 categories, reversal) and Purchases & suppliers (bills, stock, payments, reversal) — 2026-09-26.
- ✅ Cash closing — 2026-09-27: expected-cash calculation, notes & coins helper, difference with reason, counted by,
  drawer-closed tick, draft / submit / owner approve or send back, day lock, over/short and cash taken out posted,
  next day's opening, tip payouts, 30-day history, Home "Close day" and Needs attention (closes waiting, days not
  closed). SQL `03_cash_closing.test.sql` (53), e2e `17-cash-closing.spec.ts` (both modes).
- ✅ Inventory & tools — 2026-09-27: items (consumable / retail / tool), levels, value, low stock, adjustment with a
  reason, stock count, movements with who and why, tools (condition, next service, assigned to), retail products in
  Quick sale (product revenue, cost of goods, no commission), restock on a full refund, Home quick action "Stock" and
  Needs attention (low stock, tools due, supplier bills overdue / due this week), Opening stock screen, setup
  checklist's six steps. SQL `04_inventory.test.sql` (43),
  e2e `18-inventory.spec.ts` (both modes).
- ✅ Receipt photos — 2026-09-27: take or choose a photo on an expense or bill (form or details), private bucket,
  signed links, never replaced or deleted. SQL `05_receipts.test.sql` (16), e2e `19-receipts.spec.ts` (both modes).
- ✅ M2 hand-over — 2026-09-27: `docs/M2-HANDOVER.md`. Full suite 3 runs in a row 56/56; button sweep 1,098 taps,
  0 failures. Next: M3 — People & rules (05-BUILD-PLAN.md).

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

### Live status (2026-09-26)
- GitHub `libertylightllc-ctrl/saloon` `main` = the new app only (old app, Android test release and GitHub
  Pages removed). Vercel project **saloon** builds from `main`; the live link shows "Salon Control is being set
  up" until a hosted Supabase project is connected (docs/HOSTED-SUPABASE.md §6).
- Also built at the owner's request: Accounts & history, Expenses (16 categories), Purchases & suppliers.

### Next
- M2 — Money in / out (see 05-BUILD-PLAN.md). Owner actions before real use: hosted Supabase
  (docs/HOSTED-SUPABASE.md), native-speaker review of ar/hi/ur, sign-off on the ladies button contrast.

### Known issues
- None open in M1 scope.

### How to resume
Start a new session with: `Start M2 from docs/PROGRESS.md`.
Local stack: `colima start --cpu 4 --memory 6`, `npx supabase start`, then `npx expo start --web --port 8081`
(Playwright reuses it). Keep ~10 GB free on the Mac: a full disk stops the Docker VM.
