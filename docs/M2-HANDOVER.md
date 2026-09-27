# M2 hand-over — Money in / out

Date: 2026-09-27 · Branch: `main` · Local stack (Supabase in Docker on this Mac)

## What was built
- **Expenses** (built 2026-09-26 at your request): 16 categories (Tea & Food, Electricity, Water, Internet & Phone,
  Rent, Uniforms, Dry Cleaning & Laundry, Cleaning Supplies, Repairs, Transport & Fuel, Marketing, Licences/Visas,
  Bank & Card Fees, Staff Accommodation, Staff Welfare, Other) plus your own; cash comes out of the drawer, card and
  bank from the bank; the owner reverses with a reason (the expense stays, marked reversed).
- **Purchases & suppliers**: bills numbered per business, due date from supplier terms, stock lines add stock at
  their cost (weighted average), part or full payment by the owner, unpaid bills can be reversed.
- **Receipt photos**: take or choose a photo on an expense or bill (on the form or later from its details);
  private storage, the owner and cashier see their own salon's photos, a photo can never be replaced or deleted.
- **Cash closing**: how expected cash is made up (brought forward, cash sales, deposits, refunds, expenses,
  supplier payments, tip payouts), a notes & coins helper, the difference with a required reason, who counted,
  the drawer-closed tick, draft / submit for approval / owner approves or sends back. Once submitted the day takes
  no more cash (card still works). Approval posts the difference to Cash over/short and any cash taken to the bank or
  the owner, so tomorrow opens with counted − taken out. 30-day close history.
- **Tips**: each stylist/barber's tips owed (tips on their sales − refunded tips − payouts), paid in cash from
  Cash closing, never more than owed.
- **Inventory & tools**: consumables, retail products and tools; levels, stock value, low stock, opening stock,
  adjustments with a reason, stock counts, every movement with who and why; tools with condition, next service
  date and who has them. Staff see levels but never costs.
- **Retail sales**: Quick sale → Products; product revenue and cost of goods are separate from services; no
  commission on products; a full refund can put the products back on the shelf.
- **Home**: Close day on the cash card, Stock quick action, Money out, and **Needs attention**: closes waiting for
  approval, days not closed, items low on stock, tools due a service, supplier bills overdue or due this week.
  The setup banner now has the spec's six steps (adds opening stock and suppliers).
- **Demo salons**: four weeks of sales, expenses, bills, retail sales, tools and daily closes; yesterday's close is
  waiting for the owner, so Home shows real Needs attention rows.

## How it is proven
| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | clean |
| Lint | `npx eslint .` | clean |
| App tests | `npx jest` | 153 / 153 |
| Database tests | `npx supabase test db` | 227 / 227 (M1 70, money out 45, cash closing 53, inventory 43, receipts 16) |
| Database health | `supabase/checks/health.sql` | 22 integrity checks, 0 problems; both demo salons balanced |
| E2E, gents + ladies | `npx playwright test --grep-invert @sweep` | 3 runs in a row on the final code: 56/56, 56/56, 56/56, no retries; salon-type switch repeated 20/20 |
| Button sweep, owner/cashier/staff, both modes (now includes every M2 screen) | `npx playwright test --grep @sweep` | 1,098 taps, 0 failures — `docs/button-sweep/` |

The build plan's M2 checks, each an automated test in both modes: receive stock → sell → level drops (flows 16, 18);
bill → pay supplier → balance (16); cash expense lowers expected cash (15); close day short by AED 5 → cashier
submits → owner approves → locked, over/short posted (17); journal balances (13, 15–18).

## Real problems the tests caught (fixed, with tests)
1. A phone that joined live updates late, or came back from sleep, missed a salon-type switch and kept the old
   look until restarted. It now catches up on every (re)join; the unit test fails on the old code.
2. Seed data went negative on past days (expenses a month back, sales only a week back); the demo now has a
   consistent four weeks.

## Open items
- Hosted Supabase is still not set up — see `docs/HOSTED-SUPABASE.md` (you create the project; never send the
  service_role key or the database password). The live Vercel link shows "being set up" until then.
- Arabic, Hindi and Urdu text for M2 is machine-drafted, like M1 (needs a native speaker's pass).
- Cash payroll and staff advances join the expected-cash formula in M3 (payroll).
- Input VAT on supplier bills is not tracked yet (bills are recorded at their total); say if you need it before M4.

## Test on two phones
`docs/PHONE-TEST.md` — the M1 script plus a 10-minute M2 add-on (steps 11–13: expense with photo, stock,
closing the day).
