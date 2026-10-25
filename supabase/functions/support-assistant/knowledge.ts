// What the support assistant knows about Saloqo (2026-10-12; salon types 2026-10-23; free period, pilot and
// per-branch prices 2026-10-25, with the days and prices given live from the settings). Facts only: keep it in step
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
  owner gives them. The salon code is on the owner's More page ("Salon code: …") and on the Staff page.
- An owner who forgot the password: sign-in page → Forgot password? → a code arrives by email.
- A staff member who forgot the password: the owner sets a new one: More → Staff → the person → Password & sign-in.
- "This login is disabled": the owner switched that login off or removed the person, or the salon was closed. The
  salon owner can bring a person back (More → Staff → the person).
- Your profile: More → tap your name at the top: name, phone, password (the current one is needed). The owner can also
  rename the salon and change the sign-in email (confirmed from both inboxes).
- One phone at the counter for several people: More → Quick-switch PIN, then Switch user.
- Roles: the owner sees and does everything; a cashier works the till, the queue, cash expenses and the cash count
  (no payroll, no books); staff (barbers/stylists/therapists) see their own queue, their day and their own pay; an accountant
  reads reports and the books without changing them.

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
- Refunds: open the sale → Refund, with a reason (owner). A cashier asks the owner, who is notified.
- Nothing about money is ever deleted: a sale is refunded, an expense or a bill is reversed, always with a reason.
- Customers tab: profiles, visits and notes. Services: More → Services. Stock: More → Inventory & tools (products,
  counts, adjustments; Home shows low stock). Purchases & suppliers: bills, part payments; stock goes up.
- Expenses: More → Expenses (cash expenses lower the expected cash in the drawer).
- Cash closing: More → Cash closing: count the cash and submit; the owner approves and the day locks.
- Staff: More → Staff → Add: name, job, pay, and an app login if they need one. Weekly roster, attendance (clock in
  and out from Home), monthly payroll (in the UAE with the WPS file).
- Compliance: More → Compliance: licences and certificates with expiry dates and scans, staff papers, the hygiene log,
  the inspection binder (PDF) and, in the UAE, WPS and Montaji numbers. Home lists what is missing or expiring.
- Reports and Accounting (owner and accountant): exports to CSV and PDF. Backup & recovery (owner): a ZIP of all data.
- Branch settings (owner): name, address, phone, open days, country (only until money is first recorded — after that
  the currency is fixed), VAT or sales tax and the tax number, receipts, deposits, whether staff may sell.
- Notifications: the bell on Home; phone notifications when allowed.
- The refresh button (on Home and More) reloads the app; changes reach every phone of the salon within seconds.
- Deleting the account: owner only, More → Delete my account. Financial records the law requires are kept.

## When something goes wrong
- "Your salon's free time has ended" or nothing saves: the owner opens More → Plan & billing.
- "No connection", or a change not showing on another phone: check the internet, then the refresh button.
- A receipt does not print: check More → Branch settings → Customer receipt; on a computer the receipt opens the
  browser's print window; on a phone it can be shared or sent on WhatsApp.
- Times show in the phone's own clock and 12- or 24-hour setting.
`;
