# 10-minute two-phone test (M1)

Two phones, both with **Expo Go** installed, on the **same Wi-Fi as the Mac**.
Phone A is the owner, phone B the cashier. Ticks ✅ are what you should see.

## Before you start (on the Mac, 2 minutes)

```bash
npx supabase start
```

```bash
npx expo start
```

Scan the QR code from the second command with both phones (iPhone: Camera app · Android: Expo Go).
If a phone cannot connect, the Mac's firewall is blocking it: System Settings → Network → Firewall →
allow incoming connections for "node", or switch the firewall off for the test.

## 1 · Owner sign-up and setup (phone A, 2 min)

1. Tap **Gents salon**. ✅ The sign-in turns violet.
2. **New here? Create an owner account**: your name, an email, a password (8+), confirm → **Create account**.
3. Setup wizard: business name → Next → UAE → Next → **Gents** is already picked → Next →
   branch name → Next → leave VAT off, **Cash in the drawer now** `200` → **Create my salon**.
4. ✅ Home: "Good morning/afternoon, <you>", **Expected cash today AED 200.00**, sales AED 0.00,
   "No one is waiting", "Finish setting up".

## 2 · Cashier login (A creates, B signs in, 2 min)

1. A: **More → Staff**. Note the **salon code** at the top (e.g. `testgents`). **Add staff** → name `Faisal`,
   job **Cashier**, switch on **Can sign in to the app** → username `faisal`, password `Cash1234!` → **Save**.
2. B: tap **Ladies salon & spa** on purpose → **Staff** tab → salon code, `faisal`, `Cash1234!` → **Sign in**.
3. ✅ B turns **violet** (the branch is gents), tabs: Home · Queue · Sale · Customers · More.
   B's More has **no** Staff or Branch settings.

## 3 · Walk-in, live on both phones (2 min)

1. Both phones on the **Queue** tab.
2. B: **New** → **New** (customer) → name `Omar`, phone `0501234567` → **Add customer** →
   tap **Haircut** → **Add to queue**.
3. ✅ Within about 2 seconds Omar appears on **A without touching it**.
4. A: **Start** → ✅ B shows Omar "in progress". A: **Complete**.
5. ✅ A opens Quick sale with Haircut AED 25.00 in the basket. **Checkout** → customer Omar is
   filled in → **Cash** → **Save sale · AED 25.00**. ✅ A green tick: "Sale #1001 saved".
6. ✅ Both Homes: Sales today **AED 25.00**, Expected cash **AED 225.00**.

## 4 · Split, discount, tip (A, 1 min)

Sale tab → add Haircut twice → Checkout → Discount `10` → Tip `5` → **Split** → Cash `20`, Card `25`.
✅ "Left to allocate AED 0.00", Save enabled → save → ✅ total AED 45.00.

## 5 · Refund rules (1 min)

1. B: More → Sales → sale #1001. ✅ **No** Refund button for the cashier.
2. A: More → Sales → #1001 → **Refund** → amount `10`, reason `Test refund` → **Refund AED 10.00**.
   ✅ "Part refunded", the reason is shown, and Home's expected cash drops by 10.

## 6 · Switch the salon type live (1 min)

A: More → **Branch settings** → tap **Ladies salon & spa** → **Switch to Ladies salon & spa**.
✅ **Both** phones turn coral within a few seconds; B's New walk-in says "Any stylist" instead of
"Any barber". Switch back to Gents.

## 7 · Disabled login (1 min)

1. A: More → Staff → Faisal → **Password & sign-in** → **Disable login**.
   ✅ B is signed out by itself: "This login is disabled. Ask the owner."
2. A: **Password & sign-in** → **Enable login** again; B can sign in again (salon code is remembered).

## 8 · Owner's books (A, 1 min)

A: More → **Accounts & history**. ✅ Overview: opening cash + cash sales − cash refunds = the same
expected cash as Home; card payments are not in it. ✅ Trial balance says **Balanced: Yes**.
✅ Journal lists the sales and the refund; tap one to see its debit and credit lines.
✅ History shows "Saved sale #1001…" and the sign-ins. B (cashier): More has **no** Accounts & history.

## 9 · Arabic (optional, 1 min)

A: More → Language → **العربية**. ✅ The layout flips right-to-left, day and month names are Arabic
("الجمعة 25 سبتمبر"), numbers stay 0-9.

## 10 · Sign out

A: More → **Sign out** → ✅ back on the sign-in, still in the salon's colours.

If anything does not match a ✅, note the step number and what you saw.

---

# M2 add-on: money out, stock and closing the day (10 minutes, same two phones)

Continue with the salon from the M1 test (owner on phone A, cashier Faisal on phone B).

## 11 · Expenses with a receipt photo (A, 2 min)

1. A: Home → **Expense** → amount `15`, **Tea & Food**, **Cash** → **Take photo** of any paper → **Save**.
   ✅ "Expense saved"; Home's expected cash drops by 15; Money out today AED 15.00.
2. A: More → **Expenses** → the tea expense → ✅ the photo is there; tap it to see it full size.
3. B: Home → **Expense** → ✅ "Cash from the drawer" only (no card/bank), no new-category button.

## 12 · Stock (A, 3 min)

1. A: More → **Inventory & tools** → **Add item** → `Beard Oil`, **Retail product**, reorder at `3`,
   selling price `60` → **Save**.
2. A: More → **Purchases & suppliers** → **New bill** → add a supplier → add item **Beard Oil**, qty `6`,
   cost `25` → **Save bill**. ✅ Inventory shows Beard Oil **6 pc**.
3. A: **Sale** tab → **Products** → Beard Oil **+** → Checkout → Cash → Save. ✅ Inventory **5 pc**.
4. A: Beard Oil → **Adjust stock** → Take out `1`, reason `Broken` → ✅ **4 pc**, the movement shows who and why.
5. A: Inventory → **Stock count** → Beard Oil `3` → **Save count**. ✅ Beard Oil shows **Low**, and Home
   lists it under **Needs attention**.
6. B (cashier): Inventory shows levels; ✅ no Adjust, no Stock count. Staff logins see levels without any costs.

## 13 · Close the day (A and B, 4 min)

1. B: Home → **Close day**. ✅ The card shows how expected cash is made up (brought forward, sales, expenses …).
2. If a stylist earned tips: **Pay tips** → ✅ expected cash drops by what was paid.
3. B: **Count notes & coins** → enter the notes → **Use this count**. Make it AED 5 less than expected.
   ✅ "Short by AED 5.00"; a reason is required → type `Change given twice` → tick the confirmation →
   **Submit for approval**. ✅ "Sent to the owner for approval".
4. B: try a **cash** sale → ✅ refused: "This day's cash is closed…". A card sale still works.
5. A: Home → **Needs attention** → "Cash close … waiting for approval" → **Review** → **Approve closing**.
   ✅ "Day closed and locked"; Home's expected cash = what was counted; Accounts → Trial balance
   shows Cash over/short AED 5.00 and **Balanced: Yes**.

If anything does not match a ✅, note the step number and what you saw.

---

# M3 add-on: people, pay, compliance and notifications (10 minutes)

Same two phones. Phone A = owner, phone B = the barber/stylist login from step 2 (or add one in More → Staff).

## 14 · Roster and a late clock-in (3 min)

1. A: More → **Staff** → the barber → **Edit** → salary `3500`, commission `10`, **WPS** on → Save.
2. A: **Weekly roster → Edit** → switch on today, start = one hour ago, end `22:00` → **Save roster**.
3. B: Home shows **My day** with that shift → **Clock in**. ✅ "Clocked in — 60 min late" (roughly).
4. A: Staff → **Attendance** → ✅ the barber shows **In** and **Late**.

## 15 · Payroll (3 min)

1. A: Staff → **Payroll** → **Bonuses & advances** → New → the barber, **Advance** `100`, Cash → Save.
   ✅ Home's expected cash drops by 100.
2. Back → **Work out payroll** → ✅ the barber's line = 3,500 + commission − 100.
   **Approve payroll** → tap the barber → **Pay … by bank** → **Choose photo** (any screenshot) → ✅ "WPS proven".
3. B: the **My pay** tab → ✅ the payslip, the commission this month and the advance.

## 16 · Compliance (2 min)

1. A: More → **Compliance** → ✅ readiness 0%, everything **Missing**.
2. Tap **Trade licence** → **Add details** → number, expiry about two months ahead, **Take photo** → Save.
   ✅ **Valid**; readiness goes up. **Inspection binder → Export PDF** → ✅ a PDF to share.
3. The cashier: More → Compliance → ✅ only the **Hygiene log** → tick the items → **Sign the log**.

## 17 · Notifications (2 min)

1. B: Queue → a **booking** for tomorrow. ✅ A's Home bell shows **1**; the list says "New booking".
2. The cashier: More → Sales → a sale → **Ask the owner for a refund** → amount, reason → Send.
   ✅ A gets "Refund requested"; tapping it opens the sale with the request; refunding clears it.
3. (Push on the phones' lock screen needs the store/dev build — see docs/M3-HANDOVER.md, open items.)

If anything does not match a ✅, note the step number and what you saw.

---

# M4 add-on: books, reports, settings and the shared counter phone (10 minutes)

Same two phones. Phone A = owner, phone B = the cashier login.

## 18 · Reports (3 min)

1. A: More → **Reports** → ✅ **Monthly business** shows this month's sales, revenue, costs and result, a bar chart
   of sales by day and the **Owner control summary** (latest close difference, owed to suppliers, low stock,
   compliance issues).
2. Tap **Staff sales**, **Daily closing**, **Stock movement**, **Cash shortage**, **Customer list** → ✅ each shows its
   figures, chart and table; the arrows change the month.
3. **Share PDF** → ✅ a PDF in the share sheet. **Export CSV** → ✅ a CSV file (opens in Excel / Sheets).

## 19 · Close a month (2 min)

1. A: More → **Accounts & history** → **Months** → ✅ each month with entries; only finished months have **Close**.
2. Last month → **Close** → **Close the month** → ✅ **Closed**. (Nothing dated in that month can be saved now.)
3. **Reopen** → a reason → ✅ **Open** again. **Export ledger CSV** → ✅ every journal line; debits = credits.

## 20 · Receipt and backup settings (2 min)

1. A: More → **Branch settings** → VAT → **Customer receipt** → **WhatsApp** → Save.
2. B: sell a service to a customer with a phone number → **Send on WhatsApp** → ✅ WhatsApp opens with the receipt.
3. A: More → **Backup & recovery** → **Download backup (ZIP)** → ✅ a ZIP with a CSV per list (sales, customers …).

## 21 · Shared counter phone with PINs (3 min)

1. B (cashier): More → **Quick-switch PIN** → a 4-digit PIN twice → Save. ✅ "PIN saved"; **Switch user** appears.
2. **Switch user** → Someone else → the barber's username and password → Sign in → ✅ the barber is signed in.
3. Barber: More → **Quick-switch PIN** → a PIN → **Switch user** → the cashier → a wrong PIN → ✅ "That PIN is not
   right." → the right PIN → ✅ back as the cashier, no password typed.

If anything does not match a ✅, note the step number and what you saw.

---

# Launch add-on: purchase entry, legal pages, deleting an account, install (10 minutes)

Phone A = owner. Use a test salon for step 25, not your real one: deleting the owner's account closes the salon.

## 22 · A purchase like the supplier's invoice (4 min)

1. A: More → **Inventory & tools** → an item counted in ml → Edit → **Pack size (Millilitres)** = 1000 → Save.
2. More → **Purchases & suppliers** → **New bill** → a supplier → Invoice no. → Payment **Credit**.
3. **Stock item** → that item → ✅ "One pack holds (ml)" shows 1000. Qty (packs) **10**, Unit price **45** →
   ✅ VAT 5% fills in **22.50**, Total **AED 472.50**, "10000 ml into stock".
4. **Other** → "Delivery", Unit price 20 → ✅ Summary: Subtotal 470.00 · VAT 5% 23.50 · Grand total 493.50 ·
   Paid 0.00 · Supplier balance 493.50.
5. Save → ✅ "PUR-0000N saved"; the bill shows each line as "10 × 1000 ml · AED 45.00 each · VAT 5% AED 22.50".
6. **Print / PDF** → ✅ a page titled "Purchase entry" with the table Product · Qty · Unit price · VAT 5% · Total.

## 23 · Privacy policy and terms (1 min)

1. Sign out → on the landing page scroll to the bottom → **Privacy policy** → ✅ opens without signing in.
2. ✅ **Terms of use** at the bottom of it; both also under More → Account.

## 24 · The phone app does not sell plans (1 min)

1. On a phone build (not the website): More → **Plan & billing** → ✅ shows Active / Paid until, no price and no
   "Ask to switch on". The website still shows both.

## 25 · Delete an account (2 min, test salon only)

1. A test barber: More → **Delete my account** → ✅ the button stays grey until you type DELETE → Delete →
   ✅ "Your account has been deleted." and the sign-in page; that username can no longer sign in.
2. The test salon's owner: the same → ✅ the sheet says it closes the salon; after it nobody can sign in to it.

## 26 · Install the website (1 min)

1. iPhone Safari: open the Vercel link → Share → **Add to Home Screen** → ✅ the scissors icon; it opens full-screen.
2. Android Chrome: ⋮ → **Install app** → ✅ the same.

## 27 · Staff and their logins in one place (2 min)

1. A: More → **Staff** → **Add staff** → a name, job and salary, switch on **Can sign in to the app** → username +
   password → Save → ✅ their page shows the pay and **App login @username**; the Staff list shows them once.
2. **Add staff** → another person without the switch → Save → on their page **Create login** → ✅ the login joins them
   (still one entry in the list). **Password & sign-in** resets the password or turns sign-in off.
3. **Add staff** → **Accountant (login only)** → name, username, password → ✅ listed under **Login only**.

## 28 · Breaks and clocking out (2 min)

1. B (barber, clocked in): Home → **Start break** → ✅ "On break since …"; A's Attendance shows **On break**.
2. B: **End break** → ✅ "Welcome back"; the card shows "Breaks N min".
3. B: **Clock out** → ✅ it asks "Clock out for the day?" → **Cancel** → still on shift. **Clock out** → **Clock out**
   → ✅ "Your day is done." → **Back to work** → ✅ on shift again; the time away is added to the breaks.
4. A: Attendance → Sameer (no app) → **Clock out** → choose **Start break** → ✅ "Sameer … is on a break".

## 29 · Undo a no-show (1 min)

1. A: Queue → a walk-in → **…** → **Mark no-show** → ✅ it moves to No-show.
2. **…** on it → **Undo no-show** → ✅ "… is back in the queue"; a kept deposit is held again.

## 30 · Remove someone from the staff (1 min)

1. A: More → Staff → **Add staff** → "Typo Name" → Save → on their page **Remove from staff** → **Remove** →
   ✅ "Typo Name removed"; gone from the list.
2. A barber who has sales → **Remove from staff** → **Remove** → ✅ "… archived (records kept)"; listed under
   **Archived**, and their login no longer signs in. **Bring back** → ✅ back on the staff, login works again.

## 31 · A salon outside the UAE (4 min)

1. New owner email → sign up → **Where is your salon?** → search "united" → **United States** → ✅ the card reads
   "USD · no sales tax · America/New_York" (pick another time zone from the chips if needed).
2. … → **Tax and cash** → switch on **Registered for Sales tax** → rate `8.875`, **Added at the till** → ✅ "A USD
   100.00 service: the customer pays USD 108.88". Create.
3. ✅ Home in dollars; More → **Plan & billing** shows **USD 29.00** (the UAE salons still see AED 99.00).
4. Once the plan is on: sell a service → ✅ Checkout shows "Sales tax 8.875%" with the tax added to the total; the
   receipt says "Sales tax (8.875%)".
5. ✅ Staff has no WPS switch; Compliance asks for a business licence and the lease (no Ejari, no WPS & Montaji tab).
6. Another owner → **Kuwait** → ✅ prices like "KWD 2.100"; Close day → **Count notes** lists KWD 20 … 0.25 notes and
   coins down to 0.005.

## 32 · On a computer and a tablet (3 min)

1. Computer browser (window wider than 1200 px) → https://www.saloqo.com → sign in → ✅ a sidebar on the left (Today,
   Money, Business, Settings), no tabs at the bottom; Home shows four cards across and two columns below.
2. Sidebar → **Sale** → add two services → ✅ the sale panel on the right fills in; **Save sale** works without a
   pop-up.
3. Sidebar → **Queue** → click a visit → ✅ its details and **Start** / **Complete** appear on the right.
4. iPad (landscape) → ✅ a slim icon rail; Queue and Sale in two panes. Turn it upright → ✅ one pane, Checkout opens
   as a sheet again.
5. Phone → ✅ exactly as before.

## 33 · Edit and delete a compliance record (2 min)

1. More → **Compliance** → **Trade licence** row → **⋯** → **Add details** → number `CN-1234`, an expiry date → Save.
2. **⋯** again → **Edit** → change the number to `CN-12345` → Save → ✅ "Changes saved"; the row shows CN-12345 and its
   page still says version 1.
3. Open the row → **Delete** → reason `Held by the head office` → **Delete** → ✅ back on the register, the licence is gone
   and listed under **Removed** with the reason; readiness counts one record fewer.
4. **Put back** → ✅ the licence returns with CN-12345.

## 34 · Refresh the app (30 s)

1. Home → the **↻** button beside the bell → ✅ the app reloads and you are still signed in (on the web this also loads
   the newest version).
2. More → App → **Refresh app** → ✅ the same.

## 35 · Spanish, French, Portuguese and the clock (3 min)

1. More → Language → **Español** → ✅ the app is in Spanish; repeat with Français and Português.
2. A phone set to 12-hour time → ✅ times read like 9:30 PM; set to 24-hour → ✅ 21:30.
3. Sign up a test salon → Country → pick **Kazakhstan** / **Argentina** / **Romania** → ✅ the currency, tax (VAT 16%,
   IVA 21%, TVA 21%) and time zone fill in.

## 36 · Change the country (2 min)

1. A new test salon (no sales yet) → More → Branch settings → **Country** → **Change country** → search "Kazakh" →
   Kazakhstan → **Change country** → ✅ "Country changed"; the card says KZT · Asia/Almaty; Services prices are now in
   tenge (about 3,500 for a 25-dirham haircut).
2. Make one sale → back to Branch settings → ✅ the country is fixed, with a line saying why.

## 37 · The platform console (2 min)

1. Sign in with the dev account (a platform owner; no salon needed) → ✅ setup shows **Open the platform console**, or
   More → **Platform console** from a salon.
2. **Overview** → ✅ salons, accounts, sign-ups, this month's sales per currency, plan income, countries.
3. **Salons** → search a salon → ✅ owner, staff, customers, services, sales, last sign-in; tap it → **History of this
   salon** → ✅ its history.
4. **Accounts** → ✅ every sign-in; type an email under Platform owners → **Make platform owner** → ✅ badge; Remove.
