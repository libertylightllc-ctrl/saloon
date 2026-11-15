// What the support assistant knows about Saloqo (2026-10-12; salon types 2026-10-23; free period, pilot and
// per-branch prices 2026-10-25, with the days and prices given live from the settings; the menus and the five login
// types 2026-11-15, owner's app check E5). Facts only: keep it in step
// with the app and the prices (platform_settings). It is the cached part of every request, so it changes only when
// the app does.
export const KNOWLEDGE = `# Saloqo

Saloqo runs a salon day to day: the walk-in queue and bookings, quick sale and receipts, customers, services, stock,
purchases and suppliers, expenses, staff, attendance and payroll, compliance, cash closing, accounting and reports.
It works on the website www.saloqo.com on phones, tablets and computers (it can be added to the home screen). Four
salon types, each with its own look, words and starter services: Gents salon (barber shops), Ladies salon & spa,
Unisex salon, and Beauty & wellness studio (nails, lashes and brows, skincare, massage; treatment rooms). The type is
chosen at setup and can be changed in More → Branch settings. Languages: English, العربية, हिन्दी, اردو, Español, Français,
Português — More → Language in the app, or the language button at the top of the website and the sign-in pages.

## Signing in
- Only owners sign up: on the sign-in page, "New here? Create an owner account" (or Continue with Google where it
  shows), then set up the salon: country, branch, open days, tax.
- Staff sign in on the "Staff" side of the sign-in page with the salon code, their username and password, which the
  owner gives them. The salon code is on the owner's More page (under the name: "Salon code: …") and at the top of
  More → Staff. It is not in Branch settings.
- An owner who forgot the password: sign-in page → Forgot password? → a code arrives by email.
- A staff member who forgot the password: the owner (or a manager, for front desk and stylist logins in their
  branch) sets a new one: More → Staff → the person → Password & sign-in.
- "This login is disabled": the owner switched that login off or removed the person, or the salon was closed. The
  salon owner can bring a person back (More → Staff → the person).
- Your profile: More → tap your name at the top: name, phone, password (the current one is needed). The owner can also
  rename the salon and change the sign-in email (confirmed from both inboxes).
- One phone at the counter for several people: More → Quick-switch PIN, then Switch user.

## Plan and price (the days and prices are in the plan settings given with each conversation)
- Saloqo is free to start: setting up is free, and a new salon gets a free period with every feature, no card and no
  payment. Nothing is ever charged unless the owner chooses a plan. Never mention a 7-day trial.
- The pilot, for salons in the UAE: a limited number of salons are free for longer (the pilot days). Apply on the
  website's Pilot section (the team answers on WhatsApp), or type a pilot code from the Saloqo team: at sign-up
  ("Have a pilot code?") or in More → Plan & billing. One pilot per salon; the code works in any letter case. The
  owner then sees "Pilot salon · free until <date>" in More → Plan & billing.
- While billing is off (see the plan settings) nobody pays and the app shows no prices or plans; every open salon
  works. The owner sees only "Free until <date>" (or the pilot line) in More → Plan & billing.
- The price is per branch, a month: the base price for up to the included people who sign in at that branch, plus the
  extra for each person after that (AED in the UAE, USD elsewhere). The owner and the accountant count once, at the
  first branch. Pay for 1 month, 6 months (10% off) or 12 months (the price of 10). No auto-renewal, no contract.
  Staff without a login are not counted.
- Branches: the owner adds one in More → Branches → Add a branch (while billing is on, its price is shown first and
  it joins the next payment; nothing is charged then), and opens another branch from the same page.
- When billing is on: the owner is reminded 14 and 3 days before the free time ends. To pay: More → Plan & billing →
  the length → by card where it shows, or bank transfer / payment link and then "Ask for the plan". The Saloqo team
  switches a transfer on when the payment arrives. Paid months are not refunded, except where the law requires.
- If the free time has ended with billing on, nothing new can be saved until a plan is chosen; all data stays: people
  can still sign in, look and export.

## Everyday work
- Queue tab → New → Walk-in or Booking: services, the barber/stylist/therapist, date and time, an optional deposit. Then start,
  complete and check out. Bookings can be made at any time of an open day; once staff have weekly shifts, only shift
  times are offered. Open days: More → Branch settings → Open days (owner).
- Sale tab: pick services and products → checkout: cash, card or wallet, split payments, discount and tip. The
  customer receipt follows More → Branch settings → Customer receipt: none, printed, or sent on WhatsApp.
- Refunds: open the sale (More → Sales) → Refund, with a reason: the owner, or a manager (not their own sale); the
  front desk needs a manager or the owner to approve with their PIN.
- Nothing about money is ever deleted: a sale is refunded, an expense or a bill is reversed, always with a reason.
- Customers tab: profiles, visits and notes. Services: More → Services. Stock: More → Inventory & tools (products,
  counts, adjustments; Home shows low stock). Purchases & suppliers: bills, part payments; stock goes up.
- Expenses: More → Expenses (cash expenses lower the expected cash in the drawer).
- Cash closing: the Closing tab (front desk, manager) or More → Cash closing: count the cash and submit; the owner or
  a manager approves and the day locks.
- Staff: More → Staff → Add: name, job, pay, and an app login if they need one. Weekly roster, attendance (clock in
  and out from Home; More → Attendance), monthly payroll in More → Payroll (in the UAE with the WPS file); payslips
  open from Payroll, and a stylist sees their own in My pay.
- Compliance: More → Compliance: licences and certificates with expiry dates and scans, staff papers, the hygiene log,
  the inspection binder (PDF) and, in the UAE, WPS and Montaji numbers. Home lists what is missing or expiring.
- Reports (owner and accountant; managers some; stylists their own) and Accounts & history (owner and accountant):
  exports to CSV and PDF. Backup & recovery (owner): a ZIP of all data.
- Branch settings (owner): name, address, phone, open days, country (only until money is first recorded — after that
  the currency is fixed), VAT or sales tax and the tax number, receipts, deposits, whether staff may sell.
- Notifications: the bell on Home; phone notifications when allowed.
- The refresh button (on Home and More) reloads the app; changes reach every phone of the salon within seconds.
- Deleting the account: owner only, More → Delete my account. Financial records the law requires are kept.

## Where things are (the menus)
Bottom tabs on a phone (a side menu on a computer), by login type:
- Owner: Home, Queue, Sale, Customers, More.
- Manager and Front desk: Home, Queue, Sale, Customers, Closing, More.
- Stylist / therapist: Home, My bookings, Sale (only when the owner lets stylists take payments), My pay, More.
- Accountant: Home, Reports, Accounting (the Accounts & history page), More.
The More page lists only what that login can open. For the owner: Services, Inventory & tools, Sales, Expenses,
Purchases & suppliers, Cash closing, Accounts & history, Payroll, Reports, Approvals, Staff, Attendance, Compliance,
then Branch settings, Controls, Branches, Backup & recovery, Plan & billing; and Language, refresh, Quick-switch PIN,
Switch user, Help & support, Privacy, Terms, Delete my account. Other logins see fewer rows, sometimes with their own
names: a stylist sees My clients, Stock, My sales, My sales & commission and Hygiene log; the front desk sees Stock,
Petty cash and Hygiene log; the manager and accountant see Suppliers & bills.
- More → Controls (owner, for each branch): the highest discount and the petty cash without approval, the cash
  differences that need a reason or tell the owner, blind count for the front desk, and whether stylists take
  payments, see their clients' phone numbers and add bookings for themselves.
- Approvals: when a front desk or stylist login needs a manager or the owner on the spot (a bigger discount, a refund,
  a price change, more petty cash), the manager or owner types their quick-switch PIN on that phone. More → Approvals
  (owner, and managers for their branches) lists the approvals given.
- More → Staff → "What each login can do" shows this table in the app.

## The five login types and what each can do
Owner (the person who signed up), Manager, Front desk, Stylist / therapist, Accountant. The owner adds a person in
More → Staff → Add; the job chosen picks the login type (Manager; Receptionist or Cashier = Front desk; Accountant;
Assistant = no login; every other job = Stylist / therapist). The owner can change a login type on the person's page.
Managers, front desk and stylists work in the branches they are given; the accountant in every branch.
"Own" = only their own; "PIN" = a manager or the owner approves on the spot with their PIN; "View" = can see, not change.
- Bookings and queue: owner, manager, front desk all; stylist own (add and move; cancelling is for the front desk);
  accountant no. No-shows and deposits: owner, manager, front desk.
- Checkout: owner, manager, front desk; a stylist only when the owner lets stylists take payments; accountant no.
- Discounts: owner any; manager any (a reason above the limit); front desk and stylist up to the limit, above = PIN.
- Change a service price at checkout: owner; manager with a reason; front desk PIN.
- Refund a sale: owner; manager with a reason (not their own sale); front desk PIN; stylists and accountant no.
  Refund a deposit: owner, manager; front desk PIN.
- Cash closing: owner, manager and front desk count the drawer (the front desk counts without seeing the expected
  cash, and sees it after submitting); owner and manager approve (a manager not their own count); accountant views.
  Petty cash from the drawer: owner, manager; front desk up to the limit with a receipt photo, above = PIN.
  Cash taken out / bank deposit: owner, manager; the accountant views and records the bank deposit.
- Customers: owner, manager, front desk see and edit them; a stylist sees their own clients' visits and notes, with
  phone numbers hidden unless the owner allows it; merging duplicates: owner, manager; export or delete: owner only.
- Clock in and out: everyone for themselves (not the accountant); owner and manager for anyone (a manager fixes a
  missed clock-out with a reason); front desk for others with a PIN.
- Rosters: owner, manager edit; stylists see their own; front desk and accountant view.
- Adding staff, creating logins, changing a login type, salary and commission %: owner only. Reset a password or
  switch a login off: owner anyone; manager for front desk and stylist logins in their branch.
- Staff sales and commission report: owner, manager (no salaries), accountant; stylists their own.
- Payroll: the owner or the accountant works out the month and marks it paid; only the owner approves it. Bonuses,
  advances and deductions: owner, accountant. Stylists see their own payslips (My pay) once the month is approved.
- Stock: everyone sees it; count and adjust (with a reason): owner, manager; order and receive: owner, manager (the
  front desk receives deliveries). Supplier bills: owner and accountant record and pay; the manager records.
  Expenses not from the drawer: owner, manager, accountant.
- Home: owner the whole salon; manager their branch; front desk today's queue, bookings and takings; stylist their own
  day; accountant a money summary.
- Reports: owner and accountant all; manager sales, staff sales, daily closing, cash differences, stock and no-shows
  (no profit, books or salaries); stylist their own; front desk none.
- Accounts & history (journal, trial balance, VAT, ledger export): owner and accountant. Close a month: owner and
  accountant; reopen it: owner. Audit trail and sign-ins: owner, accountant; manager for their branch.
- Services and prices: the owner edits; everyone else views. Branch settings, booking page, rooms, open days,
  Controls, Branches, Backup and Delete my account: owner only; Plan & billing: owner (the accountant can look). Compliance records: owner, manager
  (accountant views). Hygiene log: everyone but the accountant. Help & support: everyone.

## When something goes wrong
- "Your salon's free time has ended" or nothing saves: the owner opens More → Plan & billing.
- "No connection", or a change not showing on another phone: check the internet, then the refresh button.
- A receipt does not print: check More → Branch settings → Customer receipt; on a computer the receipt opens the
  browser's print window; on a phone it can be shared or sent on WhatsApp.
- Times show in the phone's own clock and 12- or 24-hour setting.
`;
