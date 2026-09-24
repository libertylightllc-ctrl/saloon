# 05 — Build plan (copy-paste prompts)

Give Claude Code **one phase at a time**. Paste the prompt, let it plan, answer its questions, let it build,
then do the "You check" list on your phone before moving on. If something looks wrong, say what you see
("the header on Queue is white but should be violet in gents mode") — screenshots help.

Every prompt assumes Claude Code has read `CLAUDE.md` (it loads automatically from the project root).

---

## Phase 0 — Project scaffold

```
Read CLAUDE.md and every file in docs/. Then set up the project:
- Expo (latest stable SDK) + TypeScript strict + Expo Router, folder layout exactly as in CLAUDE.md.
- ESLint + Prettier, path alias "@/" → src/.
- Supabase: init the local project (supabase/), add the JS client in src/lib/supabase.ts using env vars
  (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY) with a .env.example.
- i18n with en/ar/hi/ur JSON files, RTL switching for ar/ur, language picker stored on device.
- Fonts: Poppins (400/500/600/700) and IBM Plex Sans Arabic via expo-font.
- src/lib/money.ts (minor units, formatting "AED 1,240.00", bps maths) with unit tests.
- src/lib/dates.ts (branch timezone, business date) with unit tests.
- docs/DECISIONS.md started.
Write a plan first, then build. Finish with how I run it on my phone.
```

**You check:** app opens on your phone (Expo Go or dev build) showing a placeholder screen; switching to Arabic flips layout.

---

## Phase 1 — Design system & theme gallery (most important for the look)

```
Build the design system from docs/02-DESIGN-SYSTEM.md.
- src/theme: tokens.ts, gents.ts, ladies.ts, ThemeProvider (mode comes from the current branch; for now a dev toggle),
  useTheme(), useTerms().
- src/ui: every component in section 3, each with both theme variants from section 2 (header band vs light header,
  multicolour vs single-tint category circles, underline vs pill tabs, tinted "Book now" vs outlined ADD/stepper, etc.).
- Illustration component with placeholders.
- A /dev/gallery screen showing every component, with toggles for gents/ladies and LTR/RTL.
- Also build three static demo screens using the components and fake data — Home, Queue and Quick sale — so we can
  judge the look against docs/reference/gents-style.jpeg and docs/reference/ladies-style.jpeg.
Open both reference images and match them closely: colours, radius, spacing, header shapes, icon style.
No backend yet.
```

**You check:** flip gents ↔ ladies in the gallery. Gents should feel like the violet Barber kit, ladies like Fashly.
Send notes and repeat this phase until you're happy — everything later reuses these components.

---

## Phase 2 — Accounts, business setup, roles

```
Implement from docs/01-PRODUCT.md §2 and §3.1 and docs/04-DATA-MODEL.md §1, §6, §8:
- Migrations: businesses, branches, members, member_branches, employees, rosters, access_history, accounts (seed
  system accounts on business creation), audit_log, notifications; RLS helpers and policies.
- Auth screens: splash, onboarding (3 slides), sign-in with Owner/Staff toggle, owner sign-up, forgot password.
- Edge Function create-staff-login (owner creates username + password; internal email pattern from the doc).
- Business setup wizard with the live theme switch on the Mode step; seeds categories, sample services and expense
  categories for the chosen mode.
- Role-aware tabs and More menu (src/lib/permissions.ts mirrored in SQL).
- Setup checklist screen + Home PromoBanner showing progress.
- SQL tests for tenancy isolation and role access.
```

**You check:** create an owner account, pick gents → violet app; create a second business, pick ladies → pink app.
Create a cashier login and sign in as them on another phone; they must not see payroll.

---

## Phase 3 — Services & customers

```
Build Services (§3.6) and Customers (§3.5) with their migrations, RLS, screens and seed data from 04-DATA-MODEL §9.
Include categories management, stock recipe editor (items can be free-text placeholders until phase 6 exists — or
create inventory_items table now), translations fields, archive, customer profile with tabs, CSV export (owner).
Use the list/detail patterns in 03-SCREENS §2.7 and §2.9.
```

**You check:** add a service with a recipe; add a customer with an allergy note and see the risk badge.

---

## Phase 4 — Queue & appointments

```
Build Queue & appointments (§3.3) and the new appointment/walk-in flow (03-SCREENS §2.4–2.5):
statuses, walk-ins, live waiting time, filters, list + timeline views, rooms for ladies mode, roster-based
available_slots(), deposits via take_deposit/settle_deposit RPCs with journal entries, cancellation policy,
no-show counting, Supabase Realtime so two phones stay in sync.
```

**You check:** on two phones, add a walk-in on one — it appears on the other within a second or two.

---

## Phase 5 — Quick sale & checkout (the heart)

```
Build Quick sale (§3.4) with the create_sale and refund_sale RPCs exactly as in 04-DATA-MODEL §7:
sequential sale numbers, lines with staff and commission, split payments, discount/tip/deposit, VAT off/on,
recipe stock deduction (warning or block per setting), balanced journal, audit log, appointment completion,
customer visit stats. Receipt sheet with PDF share via share sheet. Recent sales list and sale detail with refund.
SQL tests: totals, VAT inclusive maths, stock deduction, journal balance, refund reversal, cashier cannot refund.
```

**You check:** sell Haircut + Beard Color, pay cash, then look at stock (Beard Color down 20 ml) and share the receipt to WhatsApp.

---

## Phase 6 — Inventory, purchases, suppliers, expenses

```
Build §3.7, §3.8 and §3.9: items (consumable/retail/tool), stock levels and movements, adjustment, stock count,
opening stock; suppliers, purchase bills with photo attachment and weighted average cost, supplier payments,
reversals; expenses with categories, receipt photo, reversal. All through the RPCs in 04-DATA-MODEL §7.
"Order" from a low-stock row starts a purchase bill pre-filled with that item.
```

---

## Phase 7 — Cash closing

```
Build Cash closing (§3.12, 03-SCREENS §2.10): expected_cash() on the server with every line of the formula,
denomination helper, variance + required reason, draft/submit/approve, lock after approval, over/short posting,
cash taken out → next day's opening cash, tip payouts, close history. Notify owners on submit.
Tests for expected cash covering sales, deposits, refunds, expenses, supplier payments, advances and tip payouts.
```

**You check:** make sales and an expense, count AED 5 less than expected, submit as cashier, approve as owner.

---

## Phase 8 — Staff, attendance & payroll

```
Build §3.10: employee management (linked to logins), roster editor, clock in/out, attendance list with late flags,
adjustments (bonus/deduction/advance), monthly payroll generation, approve, mark paid, WPS evidence upload and status,
staff "My pay" view. Journal postings per 04-DATA-MODEL §7.
```

---

## Phase 9 — Compliance

```
Build §3.11 for the UAE profile: expiry register with versions and evidence uploads, statuses and reminders,
hygiene log with optional required photo, inspection binder screen with PDF export, WPS & Montaji tab,
inspection readiness %. Templates per mode seeded at setup.
```

---

## Phase 10 — Home dashboard, notifications, search, activity

```
Build the full Home (§3.2, 03-SCREENS §2.3) for every role using dashboard_today(), the Needs attention list,
charts, staff today, top services and recent activity from audit_log. Notifications list + push (expo-notifications,
push_tokens table) + daily digest via pg_cron → Edge Function at 08:00 branch time. Global search screen.
```

---

## Phase 11 — Accounting & reports

```
Build §3.13 and §3.14: accounting overview, journal, trial balance ("Balanced: Yes"), close period, ledger CSV export;
reports (monthly business, staff sales, daily closing, stock movement, cash shortage, customers) with charts and
PDF/CSV export via expo-print / expo-sharing, and the owner control summary line.
```

---

## Phase 12 — Settings, languages, polish

```
Build Settings (§3.15) including users & access, access history, branch mode switch (re-themes the app),
backup export (ZIP of CSVs via Edge Function). Fill ar/hi/ur translations (mark machine drafts for review) and
check every screen in RTL. Staff PIN quick-switch for shared counter devices. Ladies extras: service packages.
Accessibility pass (labels, 44-pt targets, contrast, Reduce Motion). Empty states and error messages per the
writing rules. Performance pass on long lists.
```

---

## Phase 13 — Release

```
Prepare for the stores: app.config.ts with name/bundle ids from src/config/brand.ts, icons and splash from
assets/brand/, EAS Build profiles (development, preview, production), EAS Submit config, a production Supabase
project checklist (migrations, RLS verified, backups, secrets), privacy policy and terms placeholders, store
listing text, and a short README for running and deploying.
```

**Needs you:** Apple Developer and Google Play accounts, final name/logo/illustrations, privacy policy URL.

---

## Phase 14 (optional) — Customer booking app

```
Read 01-PRODUCT §5. Turn the repo into a workspace with apps/business (current app) and apps/customer, sharing
src/theme, src/ui and the Supabase types in packages/. Build the customer app screens so they look like the two
reference images (onboarding, Men/Women choice, home with search/banner/categories/nearby branches, branch detail
tabs, services with ADD/stepper, select date & time from available_slots(), booking summary with online deposit,
my bookings, profile). Phone OTP sign-in. Bookings appear in the staff queue in real time with source "app".
Payment gateway integration behind an interface so the provider can be swapped.
```

**Needs you:** payment gateway merchant account and SMS provider account.
