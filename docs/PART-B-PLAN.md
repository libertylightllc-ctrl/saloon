# Part B plan — login types and permissions

The owner's brief, Part B (9 Nov 2026), asked to see the database plan before any code. The owner answered the four decisions on 10 Nov 2026 (all as recommended, delivery option A); building has started.

## In short

- **Five login types:** Owner, Manager (new), Front desk (today "Cashier"), Stylist / therapist (today "Staff"), Accountant.
- **Every rule in the brief's B2 table is checked by the database**, not only by hiding buttons. One list of "who can do what" lives in the database and the app reads the same list.
- **Manager approval with a PIN** on the same device when someone hits a limit; the action is saved with both names and shows in a new Approvals list.
- **Owner controls:** 8 settings per branch (discount limit, petty-cash limit, cash-difference limits, blind count, what stylists may do).
- **Existing logins keep working:** Cashier logins become Front desk and Staff logins become Stylist / therapist. Only the name changes; nothing is lost. Nobody becomes Manager on their own.
- **Built in 10 steps**, one database change and its tests per step, then the app screens, then a test for every row of the B2 table signed in as each login. Part B goes live as one piece, after the full test run and your OK.

## Decisions (the owner's answers, 10 Nov 2026: "1 yes, 2 A, 3 yes, 4 yes")

1. **Internal names stay; only the words change.** Inside the database the logins stay `cashier` and `staff`, shown as "Front desk" and "Stylist / therapist". Renaming them inside would touch every one of the 110 functions that check a login type, for no difference you can see. *Recommended.*
2. **"Receive a delivery" for the front desk** (there is no delivery step today; stock comes in only with a supplier bill):
   - **A (chosen):** the front desk records what arrived (items and quantities, a photo of the delivery note). It waits as "Delivery to price". The manager, accountant or owner adds the prices and it becomes the supplier bill, and only then does stock go up. The books stay simple.
   - **B:** stock goes up as soon as the front desk records it, at each item's last cost, and the bill is matched to it later. Stock is right sooner, but the books need a "delivered, not yet billed" account.
3. **A stylist's "own clients"** are customers they have served or are booked with, at any time. *Recommended.*
4. **PIN lock:** five wrong PINs lock that PIN for 15 minutes (the brief), for quick-switch as well as approvals. They are the same PIN, and today the lock is 5 minutes.

I'll decide the small points myself and write them in DECISIONS.md: for example, a manager's "own sale" (one they rang up or served) can't be refunded by that manager.

## What changes for salons already using the app

- **Front desk (today's cashiers):**
  - no more supplier bills (only "Receive a delivery");
  - blind cash count (on by default);
  - refunds and deposit refunds need a manager's PIN (today they send a refund request);
  - discounts above 10% and clocking in someone else need a PIN;
  - "Counted by" is always the person signed in.
- **Accountants:**
  - see every branch;
  - can record supplier bills and mark them paid, record expenses, work out payroll and mark it paid, and close a month (the owner still approves payroll);
  - still can't sell, refund or touch the drawer.
- **Stylists / therapists:**
  - see their own clients' visits and service notes;
  - phone numbers stay hidden unless the owner switches them on.

## Database plan, step by step

Each step is one migration file (or two) with its own database tests and one commit. Function names are the current ones.

**B-1. Foundation** (migrations 86–87)
- 86: add `manager` to the login types. This must be its own file: the database has to save a new type before anything can use it.
- 87: the permissions list.
  - A table of capabilities × login types (the B2 rows). `role_can(role, capability)` reads it, and `require_can(branch, capability)` replaces the fixed role lists inside each function as each step reaches it.
  - The app's `src/lib/permissions.ts` moves to the same capability names, and a test checks that the two lists match.
- 87: owner controls.
  - The 8 B3 settings join the branch settings, with the brief's defaults; money limits are in the salon's currency.
  - Saving them writes one audit line per changed setting.
- 87: approvals.
  - A new `approvals` table: action, limit, amount, reason, who asked, who approved, when, and the sale, refund, close or clock-in it belongs to.
  - `approve_with_pin(branch, approver, pin, action, details)` checks the approver is the owner or a manager of that branch, checks the PIN with the existing `member_pins` lock, and returns a one-time approval that lasts 5 minutes.
  - Every limited function takes that approval and uses it up.
- 87: branches. Manager, front desk and stylist work only in their assigned branches (as today for non-owners); the accountant sees all branches.

**B-2. Sales and refunds**
- `create_sale` checks the discount against the limit: front desk and stylists need an approval above it, and a manager needs a reason.
- A price changed at checkout needs a reason from a manager, or an approval for the front desk.
- `refund_sale` and deposit refunds:
  - opened to managers, with a reason, but not for a sale they made or served;
  - the front desk only with an approval.
- The front desk's `request_refund` flow is replaced by the PIN sheet.

**B-3. Cash drawer**
- `submit_cash_count`:
  - "Counted by" is always the signed-in person;
  - a reason is required at or above the reason limit;
  - the owner gets "Cash short …" at or above the notify limit.
- Blind count: `closing_preview`, `expected_cash` and Home's expected cash are hidden from the front desk until their count is in.
- `approve_cash_closing` is opened to managers, but not for a count they made (the owner may).
- Petty cash from the drawer (`record_expense`):
  - front desk up to the limit, with a receipt photo; above it, an approval;
  - cash taken out: owner and manager;
  - the accountant records bank deposits.

**B-4. Customers**
- Owner, manager and front desk: the customer list, visits, notes and contact details, and adding and editing customers.
- Stylists: a new `my_clients` view (customers they served or are booked with), with phone numbers hidden unless the control is on, and service notes for their own clients only.
- Merge: owner and manager. Export and delete: owner only (database rules plus the export screen).

**B-5. Team**
- `clock`:
  - owner and manager clock anyone in or out, and a manager fixes a missed clock-out with a reason;
  - the front desk clocks themselves, and anyone else with an approval;
  - stylists clock themselves.
- Rosters: owner and manager edit; the front desk and accountant view; stylists see their own.
- Logins (`create-staff-login`, `manage-staff-login`, `remove-staff`):
  - creating a login, changing its type, salary or commission: owner only;
  - resetting a password or disabling a login: the owner for anyone, a manager for front desk and stylists in their branch.
- Payroll:
  - the accountant records adjustments, works the month out and marks it paid;
  - only the owner approves;
  - the manager sees staff sales and commission, never salaries.

**B-6. Stock, suppliers, expenses**
- Stock counts and adjustments (reason required): owner and manager.
- Deliveries: per decision 2.
- Supplier bills:
  - record: owner, manager and accountant;
  - mark paid: owner and accountant.
- Expenses not from the drawer: owner, manager and accountant.
- The front desk no longer opens Purchases (fixes "No bills yet" while a bill is unpaid, B9).

**B-7. Reports, books, audit**
- Manager reports, for their branch: sales, staff sales, daily closing, cash differences, stock and no-shows. No profit, books or salaries: a sales-only variant of the monthly report.
- The accountant sees all reports.
- Journal, trial balance and VAT: owner and accountant.
- `close_period`: owner and accountant. `reopen_period`: owner only. The Months tab shows "Close month" to them; others see "Only the owner or accountant can close a month." (B9).
- Audit trail and sign-ins: the owner and accountant see all; a manager sees their branch.

**B-8. Notifications by login** (B6)
- Each alert goes only to the logins the brief lists.
- New alerts: missed clock-outs, no-shows, client arrived, cancellations, bills due, month ready to close.
- Old time-sensitive alerts expiring is item E1; done with this step, since it touches the same code.

**B-9. App screens**
- Tabs, menu, Home and quick actions per login (B8).
- "You don't have access to this page" on a blocked page.
- The Manager approval sheet.
- Reports → Approvals.
- Branch settings → Controls.
- Staff form (B7):
  - login type, with each type's one-line description and a "See everything this login can do" link;
  - the job list, where picking a job suggests a login type;
  - the "Job is Manager but the login is …" suggestion;
  - one way to make an accountant.
- More → Staff → "What each login can do" (the B2 table).
- All of it in 7 languages.

**B-10. Tests**
- A database test per B2 area that signs in as all five logins and checks every row: allowed actions succeed, blocked ones are refused, and PIN rows succeed only with a valid owner or manager PIN (and fail with a wrong, locked, used or expired one).
- Browser tests for the approval sheet, blind count, the manager's menu and a blocked page.
- The results go to you with the deploy.

## Size

- About 10 migrations; all 110 functions that check a login type are reviewed, and about 70 database rules (row access) are updated.
- The app's permission list grows from 4 to 5 login types and gets about 15 new capabilities.
- Part B is larger than Part A. I'll send short progress notes after each step.
