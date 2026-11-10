# Part B — test report (login types and permissions)

Run on 10 Nov 2026 against the local database with migrations 1–97 (86–97 are Part B and still wait for the owner's
OK before they go to the live database). The local database's 118 server functions from 86–97 match the files exactly.

## Totals

| Suite | What it checks | Result |
|---|---|---|
| Database tests (pgTAP, 76 files) | Every server function and row rule; Part B files 69–76 sign in as all five logins | **1,652 checks, 0 failures** |
| App tests (Jest, 54 files) | Money maths, permissions list, wording, reports, alerts text | **418 passed** |
| Browser tests (Playwright, gents and ladies looks) | Whole screens signed in as each login | **320 tests: 306 passed in the full run; the other 14 passed when run again one at a time** (see below) |

### The 14 browser tests that stopped in the full run

The full run (10 Nov, 2 browsers at once, 2 h 20 min) stopped 14 tests, and every one of them showed the same
message, "The server is taking too long. Try again in a moment". None of them failed a check:

- **8 tests** (16, 17, 18, 19, 20, 23, 25 and 57, all in the gents look): the test computer's own servers gave up
  while busy. Seven sign-ins or sign-ups hit the sign-in server's 10-second limit (its log shows
  `context deadline exceeded`), and one sale save timed out the same way. The computer was running about 13 jobs for
  8 processors, with two browsers, the app server and the database on one machine. The live site's servers do not
  share a machine like this.
- **6 tests** (41 twice, 62 and 68 in the gents look; 41 and 62 in the ladies look): the platform console's summary
  timed out. That summary is Part A code; it gets slower as the test database fills with test salons, and it is noted
  as its own fix.

All 14 were run again straight after, one at a time, with no change to the app: **14 passed, 0 failed** (6 minutes).

## Every row of the B2 table, and where it is tested

Each Part B database test signs in as the owner, a manager, the front desk, a stylist and the accountant and tries
the row: allowed actions go through, blocked ones are refused by the server, PIN rows go through only with a valid
owner or manager PIN, and reason rows only with a reason.

| B2 area | Rows | Database test | Browser test |
|---|---|---|---|
| The list itself | The capability × login table is exactly B2; the app's copy matches it | 69 §1 (and a Jest test on `src/lib/permissions.ts`) | — |
| Branches | Accountant sees every branch; others only theirs | 69 §2–3 | — |
| Bookings and queue | See the day; add, move, cancel; no-show and deposits; stylist own (others busy/free) | 70 §5–6, 72 §6 | 04, 06, 54 |
| Sales | Checkout (stylist only when allowed); discount limit and PIN; price change; refund (manager not own sale, front desk PIN); deposit refund; receipts | 70 §1–4 | 05, 07, 19, 51, **74** (PIN approval) |
| Manager approval (B5) | Who can approve; PIN once, for that action only; never yourself; 5 wrong PINs lock for 15 minutes; Approvals list | 69 §5–8, 70 §7 | **74**, 72 (Approvals list) |
| Cash drawer (B4) | Blind count; counted by the person signed in; reason and alert limits; manager can't approve own count; petty cash with photo and PIN above the limit; cash out; bank deposit; who reads closes | 71 §1–7 | 17, 63 |
| Customers | Book, own clients, phone numbers hidden from stylists, service notes, merge (owner, manager), export and delete (owner) | 72 §1–5b | — |
| Team | Clocking others (front desk PIN); missed clock-outs with reason; rosters; staff list without salaries; payroll by owner and accountant; resets; changing login type (owner) | 73 §1–9 | 02, 20, 21, 34 |
| Stock and suppliers | See stock (stylists without cost); counts with reason; deliveries (front desk receives, others price); bills and payments; suppliers; expenses | 74 §1–6 | 16, 18, 71 |
| Reports and books | Reports per login; close / reopen a month; audit trail and sign-ins; compliance; hygiene log | 75 §1–5 | 22, 24, 72 |
| Setup | Controls (owner only, audited) | 69 §4 | 73 |
| Alerts (B6) | Each login gets only its own alerts; owner covers a missing login type; nobody alerted about what they did; alerts end | 76 §1–14 | 23 |
| Menus and blocked pages (B8) | Tabs and More per login; a page the login may not open says so | — | **74**, 72 |
