# 01 — Product spec

## 1. What we are building

A phone-and-tablet app that a salon owner, cashier and staff use every day to run the shop.
It replaces paper registers, the cash notebook, the stock list and the "documents folder".

First market: **United Arab Emirates** (AED, optional 5% VAT, Dubai Municipality rules, WPS).
Build the country bits behind a `country_profile` so other countries can be added later.

It is **multi-tenant**: one business can have several branches; we can sell the app to other salons.

### 1.1 Two modes

Each branch picks a mode at setup (owner can change it later in Settings).

| | `gents` — Barber shop | `ladies` — Ladies salon & spa |
|---|---|---|
| Theme | Violet (reference: Barber kit) | Coral-pink (reference: Fashly) |
| Staff called | Barber | Stylist (hair/nails/makeup) or Therapist (spa) — per employee |
| Work place called | Chair | Station, or Room for spa services |
| Day-to-day focus | Walk-in queue first, appointments second | Appointments first, walk-ins second |
| Default categories | Hair, Beard, Color, Face, Massage | Hair, Color, Nails, Facial, Makeup, Waxing & Threading, Spa & Massage, Bridal |
| Extra features | — | Rooms/beds for spa services, service packages (phase 12), patch-test reminders on by default, customer photos off by default (privacy) |
| Compliance template | UAE gents salon | UAE ladies salon (same list + female-staff-only note) |

Everything else (sales, stock, cash, payroll, accounting, reports) is identical.
Implement differences through `mode` config (`src/features/mode/`), not `if` statements scattered around.

### 1.2 Terminology hook

`useTerms()` returns words for the current mode, e.g. `terms.staff` → "Barber" / "Stylist",
`terms.staffPlural`, `terms.station` → "Chair" / "Station", `terms.shop` → "Barber shop" / "Salon & spa".
All strings are i18n keys with a mode suffix: `terms.staff.gents`, `terms.staff.ladies`.

## 2. Roles and permissions

| Area | Owner | Cashier | Staff (barber / stylist / therapist) | Accountant (read-only) |
|---|---|---|---|---|
| Home dashboard | Full | Operations (no accounting, no payroll) | Personal: my queue, my sales, my commission | Money cards only |
| Queue & appointments | Full | Full | See all; start/complete own; add walk-in | — |
| Quick sale | Yes | Yes | Only if setting "Staff can record sales" is on | — |
| Refund a sale / reverse anything | Yes | No (can "request" — sends owner a notification) | No | — |
| Customers | Full | Full | View name, notes, preferences, risk notes; phone masked | — |
| Services & prices | Edit | View | View | View |
| Inventory | Full | Receive stock, see levels | See levels | View |
| Purchases & suppliers | Full | Add bill, no payments | — | View |
| Expenses | Full | Add cash expense | — | View |
| Staff & payroll | Full | — | Own attendance, own commission | View payroll totals |
| Attendance | Full | Record for others | Clock self in/out | — |
| Compliance | Full | Add hygiene log entries | — | — |
| Cash closing | Count and approve | Count and submit | — | View |
| Accounting & reports | Full | — | — | Full view + export |
| Setup & settings | Full | — | — | — |

Permissions live in one place: `src/lib/permissions.ts` (app) mirrored by SQL helper functions (RLS).

### 2.1 Sign-in

- **Owner:** email + password (Supabase Auth). Creates the business.
- **Staff and cashier:** username + password created by the owner (e.g. `rafiq`, `cashier111`).
  Implement as Supabase Auth users with an internal email `username@<business-code>.staff.internal`,
  created by an Edge Function using the service role. The user only ever types the username.
- **Shared counter device (phase 12):** quick switch between logged-in staff with a 4-digit PIN.
- Every sign-in writes to `access_history`.

## 3. Modules and business rules

### 3.1 Setup (launch checklist)

Shown on Home as a progress banner until complete. Six steps:
1. Services and prices approved
2. Staff logins created
3. Tax mode confirmed (VAT off / VAT on)
4. Cash drawer opening balance set
5. Opening stock counted
6. Suppliers added

Business setup wizard (first run): business name → country (UAE) → **mode choice** (two big cards that
preview each theme; the app re-themes live when tapped) → branch name, address, opening hours → VAT mode.
Choosing a mode seeds default categories, sample services with stock recipes, expense categories and
the compliance template for that mode. Owner can edit everything after.

### 3.2 Home (dashboard)

- Greeting with owner name and branch; subline like "4 customers in the queue, 1 item needs your approval."
- KPI cards: **Expected cash today** (vs yesterday %), **Sales today** (amount · services count · sales count),
  **Appointments today** (done / waiting / no-show), **Money out today** (purchases paid + expenses).
- **Needs attention** list: cash closing waiting for approval, documents expiring/missing,
  items below reorder level, supplier bills due soon/overdue, payroll/WPS pending, setup incomplete.
  Each row has one action button (Review / Renew / Order / Pay).
- Today's queue preview (next 5) with quick actions (Start / Complete / Check in).
- Revenue last 7 days (bar chart) and payment mix today (cash / card / wallet / deposits used).
- Staff today: services, sales, commission so far, status (on shift / with client / off).
- Top services this week by revenue.
- Recent activity (from audit log) with "View audit trail".
- "Close day" button (goes to Cash Closing) and a "New sale" button.

### 3.3 Queue & appointments

- Statuses: `booked` → `waiting` (checked in) → `in_progress` → `completed`; also `cancelled`, `no_show`.
- **Walk-in:** created straight into `waiting`; name optional ("Guest"); optional preferred staff ("Any").
- **Appointment:** date/time, customer, services, staff (or Any), optional deposit; in `ladies` mode a room
  is required for services marked `requires_room`.
- Show waiting time live ("waiting 6 min"); target under 10 min (setting). Show "in 25 min" for booked.
- Filters: All / Waiting / Booked / In progress / Completed / No-show; staff filter; day chips
  Today / Tomorrow / This week. Views: **List** and **Timeline** (columns per staff).
- Row badges: walk-in, preferred staff, "patch test before colour", "2nd no-show", visit count.
- Actions: Check in, Start, Complete (opens Quick Sale pre-filled), Cancel (reason), No-show, Rebook.
- **Deposits** are held as a liability and applied at checkout. Cancellation policy (setting, default 12 h):
  cancel before the cut-off → refund deposit; later or no-show → deposit forfeited (other income).
- No-show increments the customer's `no_show_count`; 2+ shows a risk badge.
- Queue updates in real time on every device (Supabase Realtime).

### 3.4 Quick sale / checkout

- Service grid with category pills (All + categories); each tile: name, recipe summary, duration, price,
  quantity stepper. "Custom service" for a one-off name + price.
- Retail products can also be sold (items of kind `retail`).
- Customer: search existing, "one-time guest", or add new (name + phone only).
- Staff per sale (default) with per-line override.
- Payment: Cash / Card / Wallet / Split (enter amounts per method; must equal amount due).
- Discount (amount or %), tip, apply held deposit.
- Totals: subtotal, discount, VAT (or "Not applied" when VAT off), amount due.
- Save shows exactly what will update: "Updates expected cash, Sameer's commission and stock (Beard Color 20 ml, …)".
- On save (one RPC `create_sale`): sale + lines + payments, stock deduction from recipes, journal entry,
  appointment → completed, customer visit count/last visit, audit log.
- Stock check: if recipe stock is short → warning; if setting "Block sales when stock is insufficient" is on → block.
- After save: receipt sheet — Share receipt (PDF via share sheet, so the cashier can send it on WhatsApp),
  Print (if a printer is available), Done.
- Recent sales list with filters; each sale → detail with Refund (owner) and Receipt.
- Refund: full or partial, method, required reason. Services' stock is not returned; retail can be returned to stock.
- Sale numbers are sequential per branch (`#1042`).

### 3.5 Customers

- Profile: name, phone, visits, last visit, preferred staff, preferences text ("Skin fade, beard line"),
  risk notes (allergy, patch test, no-shows), marketing opt-in, visit history (sales), upcoming appointments.
- KPIs: profiles, new this month, regulars (3+ visits in 90 days), customers with risk notes, average days between visits.
- Walk-ins never need to register. Export CSV (owner). Actions from a row: Book, New sale.

### 3.6 Services

- Categories (sortable), services with price, duration, buffer, active/archived, translations (ar, hi, ur),
  **stock recipe** (item + quantity per service), `requires_room` and `requires_patch_test` flags.
- Archiving keeps history; archived services can't be sold.

### 3.7 Inventory & tools

- Items: kind `consumable` / `retail` / `tool`; unit (pcs, ml, g, pairs); location (store room, colour station…);
  reorder level; weighted average unit cost; value = qty × cost.
- Tools: quantity, condition (good / needs service), next service date, assigned to (chair / team).
- Every change is a **stock movement** (purchase, service use, retail sale, adjustment, count, reversal) with who and why.
- KPIs: stock value, low stock count, active items, movements last 30 days. Filters: All / Low stock / Consumables / Tools.
- Actions: Stock adjustment (reason required), Stock count (enter counted qty for many items), Order (starts a purchase bill).

### 3.8 Purchases & suppliers

- Supplier: name, phone, TRN (optional), payment terms (days).
- Purchase bill: supplier, invoice ref (optional), date, due date (from terms), lines (item or free text, qty, unit cost),
  attachment photo, "update stock" toggle per line for tracked items.
- Posting a bill always increases the supplier balance; tracked lines add stock and update average cost.
- Record payment (cash / card / bank) against a bill or on account. Reverse a bill with reason.
- KPIs: supplier payable, purchases this month, paid this month, overdue count. Supplier list with balance and status.

### 3.9 Expenses

- Money spent that is not stock. Categories (defaults): Tea & Food, Dry Cleaning, Rent & Utilities, Repairs, Staff, Other.
- Fields: date, category, note, paid by, method, amount, receipt photo. Reverse with reason.
- Cash expenses reduce expected cash for the day. KPIs: today, this month vs last month, biggest category.

### 3.10 Staff, attendance & payroll

- Employee: name, employee ID, role title (Barber / Stylist / Therapist / Cashier / Manager), login username,
  base salary, commission % (on net service revenue, excluding tips and VAT), WPS required, phone, colour for the timeline.
- Roster: weekly working days/hours per employee (used for booking availability).
- Attendance: clock in / out (self or recorded by cashier/owner), late flag vs roster.
- Adjustments per month: bonus, deduction, advance (cash advances reduce expected cash on the day given).
- Payroll run per month: base + commission + bonus − deductions − advances = net. Statuses: generated → approved → paid.
  Mark paid per employee (cash / bank). WPS: required employees need evidence upload (bank transfer proof) → "WPS proven".
  Dashboard target: 85% of WPS proven by day 5 of the month (setting).
- Tips: recorded per line/sale for the staff member; paid out in cash from Cash Closing ("Pay out tips").

### 3.11 Compliance (UAE profile)

- **Expiry register:** document type, holder (company / premises / employee), number, expiry date, renewal cost,
  evidence file, reminder (default 30 days before), version history (renewing creates a new version).
  Default types: Trade licence, Ejari / tenancy contract, Pest control certificate, Occupational health card (per staff),
  Staff visa / residence permit (per staff), Staff vaccination record (per staff), Civil defence certificate.
  Status: Valid / Due soon / Expired / Missing date / Evidence missing.
- **Hygiene log:** daily checklist (tools sterilised, towels changed, surfaces cleaned, waste disposed…) signed by a user;
  setting "Require evidence" forces a photo.
- **Inspection binder:** one screen that lists everything an inspector asks for, with status, and exports a PDF.
- **WPS & Montaji:** WPS status for the month (from payroll); Montaji = product registration numbers for cosmetic
  products used (linked to inventory items).
- **Inspection readiness %** = records valid and evidenced ÷ total required records.

### 3.12 Cash closing

- One controlled close per branch per business date.
- **Expected cash** (computed on the server):
  opening cash
  \+ cash sale payments + cash deposits received
  − cash refunds − cash deposit refunds
  − cash expenses − supplier cash payments − cash payroll & advances − tip payouts
- Cashier enters counted cash (optional denomination helper), picks "counted by", ticks
  "I confirm the count was done with the drawer closed to sales", saves draft or submits.
- Variance ≠ 0 requires a reason. Owner approves → record is locked, variance is posted to "Cash over/short".
- Optional "Cash taken out after close" (to bank / owner) → next day's opening cash = counted − taken out.
- Close history with Expected / Counted / Variance / Status; pending approvals appear on Home.

### 3.13 Accounting

- Double-entry ledger, invisible to normal users. Every business event posts a balanced journal entry.
- Screens: KPIs (cash balance, revenue posted this month, cost & expenses, operating result vs last month),
  Journal (latest entries), Trial balance (must show "Balanced: Yes"), Close period (locks the month), Export ledger CSV.

### 3.14 Reports

Monthly business · Staff sales (sales, services, revenue, commission) · Daily closing · Stock movement ·
Cash shortage · Customer list. Each: month picker, on-screen summary + chart, export PDF and CSV,
and an "Owner control summary" line (latest close variance, supplier balances, low items, compliance issues).

### 3.15 Settings

- Tax & receipt: VAT off (internal records, no TRN / VAT fields) or VAT on (TRN, invoice numbering, 5% inclusive
  display, VAT on reports); customer receipt: disabled / simple / WhatsApp (WhatsApp API later — for now share sheet).
- Inventory: track service inventory; block sales when recipe stock is insufficient.
- Compliance: require evidence before signing logs.
- Queue: waiting-time target, cancellation cut-off hours, default deposit.
- Staff: staff can record sales.
- Users & access: invite/disable users, reset passwords, roles; Access history.
- Branch: name, mode (gents/ladies), hours, timezone. Language, appearance (light for now).
- Backup & recovery: export all data (ZIP of CSVs).

### 3.16 Notifications

In-app list (bell with unread count, "Mark all as read") + push for: new booking, walk-in waiting > target,
closing submitted / variance pending, low stock, document due in 30/7/0 days, payroll generated, refund requested.
Daily digest job at 08:00 branch time (pg_cron → Edge Function).

### 3.17 Global search

Search button on Home header: customers (name/phone), services, sale number, inventory items, suppliers.

### 3.18 Languages

English (default), Arabic, Hindi, Urdu. Arabic and Urdu are right-to-left. Service names have translations.
Numbers and money use Latin digits by default (setting later).

## 4. Out of scope for v1 (keep the door open)

Online card payments inside the staff app (card terminal is separate — we only record the method) ·
WhatsApp Business API · dark mode · offline sales queue · loyalty points · multi-currency in one business.

## 5. Phase 2 (optional) — customer booking app

A separate app (same codebase, same database) that looks most like the two reference images:
onboarding slides, choose Men / Women (sets theme), home with search, offer banner, categories and
"Nearby" branches, branch detail with About / Services / Gallery / Reviews tabs, services list with ADD / stepper,
select date & time (real availability from roster + bookings + rooms), booking summary with online deposit,
my bookings (cancel / reschedule within policy), profile. Bookings land in the staff app queue in real time
with source `app`. Needs a payment gateway and SMS OTP provider (owner to set up accounts).
