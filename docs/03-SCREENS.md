# 03 — Screens & navigation

Phone first (375–430 pt wide). On tablets (≥ 768 pt) Queue, Quick Sale and Cash Closing use a two-pane layout
because a tablet at the counter is a common setup. All screens work in RTL.

## 1. Navigation map

```
(auth)
  splash
  onboarding (3 slides)            → sign-in
  sign-in  [Owner | Staff] toggle  → forgot-password
  sign-up (owner)                  → business-setup wizard (5 steps) → (tabs)/home

(tabs)  — role-aware bottom bar
  home        Home dashboard
  queue       Queue & appointments
  sale        Quick sale            (centre tab, slightly larger icon)
  customers   Customers
  more        Menu of every other module

Stack screens (pushed from tabs / More)
  search                          global search
  notifications
  appointment/new, appointment/[id]
  sale/[id]  (receipt, refund)     sales/ (recent sales list)
  customer/new, customer/[id]
  services/, services/[id], services/categories
  inventory/, inventory/[id], inventory/adjust, inventory/count
  purchases/, purchases/new, purchases/[id], suppliers/, suppliers/[id], suppliers/pay
  expenses/, expenses/new, expenses/[id]
  staff/, staff/[id], staff/new, attendance/, payroll/, payroll/[period], payroll/adjustments
  compliance/ (tabs: Expiry register · Inspection binder · Hygiene log · WPS & Montaji), compliance/doc/[id]
  cash-closing/, cash-closing/[date]
  accounting/ (tabs: Overview · Journal · Trial balance), accounting/close-period
  reports/, reports/[type]
  setup/ (launch checklist)
  settings/ (Tax & receipt · Queue · Inventory · Compliance · Staff · Users & access · Access history · Branch · Language · Backup)
  profile/ (my profile, change password, language, log out)
  dev/gallery (dev builds only)
```

Tabs by role: Owner & Cashier → Home, Queue, Sale, Customers, More. Staff → Home, Queue, (Sale if allowed), My pay, More.
Accountant → Home, Reports, Accounting, More.

## 2. Key screens

### 2.1 Onboarding (reference: Fashly slides / Barber onboarding)

Illustration top 55%, card bottom with `h2` title, `body` subtitle in `n70`, progress dashes, "Next" (last: "Get started").
Slides: "Run your salon from your phone" · "Queue, bookings and sales in one place" · "Close every day with confidence".
Before a mode is chosen, onboarding uses the gents theme; after the owner picks a mode everything follows it.

### 2.2 Business setup wizard

Steps with progress dashes: Business → Country → **Mode** → Branch & hours → Tax.
Mode step: two large cards side by side (stacked on small phones): "Gents barber shop" (violet preview: mini header band
+ category circles) and "Ladies salon & spa" (coral preview: pill tabs + ADD button). Tapping one cross-fades the whole
wizard into that theme.

### 2.3 Home

```
┌───────────────────────────────────────┐
│ ▓▓ header (band or light, per theme)   │  Avatar  Good afternoon, Tehseem        🔍 🔔3
│ ▓▓ Al Barsha Gents · Tue 22 Sep        │  "4 in the queue · 1 needs approval"
│ ┌───────────────────────────────────┐ │
│ │ Expected cash today   AED 1,240.00│ │  ← KPI hero card overlapping the band
│ │ ▲12% vs yesterday     [Close day] │ │
│ └───────────────────────────────────┘ │
│ [Sales today] [Appointments] [Money out]  ← horizontal KPI cards
│ PromoBanner: setup 4/6 or top "needs attention" item
│ Quick actions (CategoryCircle row): Walk-in · Book · New sale · Expense · Stock
│ Needs attention  (ListRows with action button)
│ Today's queue    (next 5 + "Open queue")
│ Revenue · 7 days (bar chart)  |  Payment mix today
│ Staff today      (avatar rows: services · sales · commission · status)
│ Top services this week
│ Recent activity  (+ View audit trail)
└───────────────────────────────────────┘
```

Staff role Home: my next customers, my services today, my commission this month, clock in/out button.

### 2.4 Queue

Header with title "Queue", "+ New" button. Summary chips: Waiting 2 (longest 6 min) · Booked 7 · Completed 4 · Deposits held.
Day chips Today / Tomorrow / This week; PillTabs for status; staff filter avatars; List ↔ Timeline toggle.
Row = ListRow: time (and "waiting 6 min" / "in 25 min"), avatar initials, name, badges, service + price, staff, StatusPill,
one primary action (Start / Complete / Check in / Rebook) and a "…" menu (Cancel, No-show, Edit).
Timeline: columns per staff (and per room in ladies mode), 15-min grid, drag to reschedule (phase 12 polish).
Empty state: `queue-empty` "No one is waiting. Add a walk-in."

### 2.5 New appointment / walk-in (bottom sheet → full screen)

Segment: Walk-in | Appointment. Customer search / guest / new. Services (multi-select with prices, durations).
Staff (avatars + "Any"). For appointments: MonthSwitcher + DateStrip + TimeSlotGrid (reference: Barber "Select Date & Time")
showing only free slots; room picker when needed; deposit amount + method. Button: "Add to queue" / "Book appointment".

### 2.6 Quick sale

Phone: service grid (2 columns, ListRow-style tiles with Stepper) with PillTabs categories on top and a sticky bottom bar
"2 services · AED 70.00 — Checkout". Checkout is a full-height bottom sheet: customer, staff, lines, discount / tip / deposit,
payment method segment (Cash · Card · Wallet · Split), totals, what-will-update note, "Save sale · AED 70.00".
Tablet: grid left, checkout right.
After save: success sheet with check animation, sale number, Share receipt, Print, New sale.

### 2.7 Customers

SearchBar, KPI chips (Profiles · Regulars · Risk notes · Avg return), sort (last visit / visits / name), list rows with
visits count, last visit, preference, risk StatusPill, actions Book / New sale. Customer detail uses a profile header
(reference: Barber "Profile" band with avatar) and tabs: Overview · Visits · Appointments · Notes.

### 2.8 More

Profile card at top (name, role, branch switcher if more than one branch), then grouped MenuRows
(reference: Barber kit Profile list with coloured icon squares):
- Catalogue & stock: Services · Inventory & tools · Purchases & suppliers · Expenses
- People & compliance: Staff & payroll · Attendance · Compliance
- Money & reports: Cash closing · Accounting · Reports
- System: Setup · Settings · Notifications · Language · Log out
Hidden rows for roles without access.

### 2.9 Module list screens (Services, Inventory, Purchases, Expenses, Staff, Compliance)

Same pattern: HeaderBand with title + subtitle (one line explaining the module), a horizontal row of 3–4 KpiCards,
PillTabs filters, SearchBar, list of ListRows, floating or header "+ Add" button, EmptyState.
Detail screens: header with key facts, sections as Cards, actions in a sticky bottom bar.

### 2.10 Cash closing

Card "Expected cash · Tue 22 Sep" with the formula lines (opening, + cash sales & deposits, − expenses, − supplier payments,
− payroll & advances, − tip payouts, = expected). MoneyInput "Actual cash counted" with optional denomination helper sheet.
Live variance chip (Short by AED 5.00 in error colours / Over in warning / Balanced in success). Reason field appears when
variance ≠ 0. Counted by, confirm checkbox, "Save draft" + "Submit for approval" (cashier) / "Approve closing" (owner).
Close history list below.

### 2.11 Reports

Report type as PillTabs, MonthSwitcher, summary KpiCards, chart, table rows, sticky bar: Print · Export PDF · Export CSV.
