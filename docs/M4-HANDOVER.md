# M4 hand-over — Books & finish

Date: 2026-09-29, updated 2026-09-30 · Branch: `main` · Proven on the local stack (Supabase in Docker on this Mac);
live at the Vercel link with hosted Supabase

## What was built
- **Close month** (Accounting → **Months**): each month with entries, open or closed. You close a finished month
  when its books balance; after that nothing dated in it can be saved (sales, costs, corrections). Reopening needs a
  reason, which stays in the history. The accountant sees the months but cannot close them.
- **Ledger CSV**: every journal line (date, source, memo, account, debit, credit) for your accountant or auditor.
- **Reports** (More → Reports; the accountant has its own **Reports** and **Accounting** tabs): Monthly business,
  Staff sales, Daily closing, Stock movement, Cash shortage, Customer list. Each has a month picker, headline
  figures (with the change from last month where it makes sense), a bar chart, the table, **Print / Share PDF** and
  **Export CSV**, and the **Owner control summary**: latest close difference, owed to suppliers, items low on stock,
  compliance issues.
- **Customer receipt** setting (Branch settings → VAT): none, print/share, or **WhatsApp** (opens WhatsApp with the
  receipt for the customer's number).
- **Backup & recovery** (More): one ZIP with every list of the salon as a spreadsheet file.
- **Shared counter phone**: everyone can set a 4-digit **quick-switch PIN**; **Switch user** swaps between people who
  signed in on that phone without typing passwords. Five wrong PINs lock it for five minutes.
- **Faster at size**: the customer list loads as you scroll and draws only what is on screen; access checks in the
  database now run once per request instead of once per row (a 1,200-customer salon was timing out); reports,
  backups and the ledger are read in pages so nothing is cut off at 1,000 rows.
- **Languages**: every main screen checked automatically in Arabic, Urdu and Hindi.
- **Store builds ready**: EAS build profiles and `docs/STORE-RELEASE.md` (needs your Expo, Apple and Google accounts).

### Added after M4 (2026-09-29 / 30)
- **Landing page**, **Continue with Google**, **paid plans** (AED 99 per branch a month; you switch plans on in
  More → Salons & plans after the payment).
- **Your feedback**: optional service time, staff name on sales and receipts, show password, VAT on bills and
  expenses, the **VAT report**; pop-up panels open again after a tap outside.
- **Purchase entry like the supplier's invoice**: Qty (packs) · Unit price · VAT 5% · Total per product; Subtotal ·
  VAT 5% · Grand total · Paid · Supplier balance; numbered PUR-00001; Print / PDF. Items have a pack size (a 1 L
  bottle = 1000 ml), so 10 bottles add 10,000 ml to stock.
- **Launch items**: Privacy policy and Terms (/privacy, /terms); **Delete my account** (an owner's closes the salon;
  records are kept 5 years as the law requires); the phone apps show the plan but do not sell it (store rules);
  the website installs to the home screen with its own icon.
- **Staff is one place** for people, pay and logins (Team & logins is gone): Add staff has a "Can sign in to the app"
  switch; each person's page has an App login card; an outside accountant can be added as login only. People who had
  been recorded twice were merged.

## How it is proven
| Check | Command | Result |
|---|---|---|
| Type check / lint | `npx tsc --noEmit` · `npx eslint .` | clean |
| App tests | `npx jest` | 183 / 183 |
| Database tests | `npx supabase test db` | 545 / 545 (M4: books & reports 25, PIN switch 14, access-check shape 2; plans 24; feedback & VAT 22; purchases & account deletion 38; one person one record 14; local month 4; breaks 14; tips 5; undo no-show 10) |
| E2E, gents + ladies | `npx playwright test --grep-invert @sweep` | 114 / 114 in 3 runs in a row (2026-10-01, app at commit 51c183e; 21, 29 and 19 min; no live-update drops) |
| Button sweep (every screen, owner / cashier / staff / accountant) | `npx playwright test --grep @sweep` | 8 / 8 — 1869 buttons in both modes for owner, cashier, staff and accountant, 0 without a visible effect (docs/button-sweep/) |

The build plan's M4 checks: the trial balance balances after the full suite (flow 13 and the ledger CSV in flow 24
compare debits and credits with the books); every report exports (flow 24, PDF and CSV, both modes); PIN switch,
receipt modes and backup (flow 25); 1,200 customers (flow 26); Arabic / Urdu / Hindi on 23 screens (flow 27).

## Open items (need you)
- **Store builds install**: the last M4 check needs your Expo account (free), an Apple Developer account and a
  Google Play account — `docs/STORE-RELEASE.md` has every command. Push on real phones starts working with that build.
- **Hosted Supabase** is set up and live (`docs/HOSTED-SUPABASE.md`). If you ever need to share anything, send only the
  Project URL and the anon key — **never the service_role key or the database password**.
- **Before the stores**: your company's legal name and a real support email in `src/config/brand.json`, and a lawyer's
  read of /privacy and /terms (a sensible start, not legal advice).
- Arabic, Hindi and Urdu texts are machine drafts: a native speaker should read them before customers do.
- The app name "Salon Control" and the store identifier `com.saloncontrol.app` (src/config/brand.json) can change
  until the first store upload, never after.

## Test on two phones
`docs/PHONE-TEST.md` — steps 18–21 cover M4 (reports, close month, receipt and backup settings, PIN switch);
steps 22–27 the purchase entry, legal pages, plan screen on phones, deleting an account, installing the website and
one record per person.
