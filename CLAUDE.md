# CLAUDE.md — Salon Control (working name)

You are building a mobile app that runs a salon day to day: walk-in queue and appointments,
quick sale / checkout, customers, services, stock, purchases, expenses, staff and payroll,
UAE compliance, daily cash closing, accounting and reports.

The app has two **modes**, chosen per branch, and each mode has its own look:

| Mode | Who it is for | Look |
|---|---|---|
| `gents` | Barber shops / gents salons | Violet "Barber booking" style — `docs/reference/gents-style.jpeg` |
| `ladies` | Ladies salons & spas | Coral-pink "Fashly" style — `docs/reference/ladies-style.jpeg` |

The **features** come from `docs/reference/feature-reference.html` (a desktop dashboard called
"Salon Control"). Take its features and business rules, **not its visual design**.
The visual design comes only from the two reference images.

## Read before every task

1. `docs/01-PRODUCT.md` — modes, roles, every feature and business rule
2. `docs/02-DESIGN-SYSTEM.md` — tokens for both themes, components, writing rules
3. `docs/03-SCREENS.md` — navigation and every screen
4. `docs/04-DATA-MODEL.md` — database tables, posting rules, security
5. `docs/05-BUILD-PLAN.md` — the phase you are on and its acceptance checks

If a doc and the code disagree, the doc wins unless the owner has said otherwise in chat.
If a doc is silent, choose the simplest option, write it down in `docs/DECISIONS.md`
(date + one line), and carry on.

## Stack (decided — do not swap without asking)

- **App:** Expo (latest stable SDK) + React Native + TypeScript (strict) + Expo Router
- **Backend:** Supabase — Postgres, Auth, Storage, Realtime, Edge Functions, pg_cron
- **Data fetching:** TanStack Query + `@supabase/supabase-js`
- **Forms:** react-hook-form + zod
- **Styling:** our own `ThemeProvider` + tokens in `src/theme/` (no hardcoded colours anywhere)
- **Icons:** `lucide-react-native` (line icons, 1.75 stroke — matches both reference kits)
- **Charts:** `react-native-gifted-charts`
- **Lists:** `@shopify/flash-list` for long lists
- **Bottom sheets:** `@gorhom/bottom-sheet`
- **i18n:** `i18next` + `react-i18next` + `expo-localization`; languages en, ar, hi, ur; RTL for ar and ur
- **Dates:** `date-fns` + `date-fns-tz` (branch timezone, default `Asia/Dubai`)
- **Exports:** `expo-print` (PDF), `expo-file-system` + `expo-sharing` (CSV / share sheet)
- **Push:** `expo-notifications`
- **Tests:** Jest + React Native Testing Library for app logic; SQL tests (`supabase test db`) for database functions
- **Builds:** EAS Build / EAS Submit

## Folder layout

```
app/                    Expo Router routes (thin — screens compose from src/)
  (auth)/               splash, onboarding, sign-in, sign-up, business setup
  (tabs)/               home, queue, sale, customers, more
  ...                   stack screens per module (services/, inventory/, cash-closing/ ...)
src/
  theme/                tokens.ts, gents.ts, ladies.ts, ThemeProvider.tsx, useTheme.ts
  ui/                   shared components (Button, Card, ListRow, HeaderBand, StatusPill ...)
  features/<module>/    hooks, api calls, components for one module
  lib/                  supabase client, money, dates, permissions, i18n setup
  locales/{en,ar,hi,ur}.json
  config/brand.ts       app name, support email — the only place the brand name lives
assets/
  fonts/  illustrations/gents/  illustrations/ladies/
supabase/
  migrations/  seed.sql  functions/  tests/
docs/
```

## Non-negotiable rules

1. **Money is integers in minor units** (fils: 1 AED = 100). Never floats. Use `src/lib/money.ts`
   for all maths and formatting. Percentages are stored as basis points (12% = 1200).
2. **Nothing financial is ever deleted.** Sales are refunded, expenses and bills are reversed —
   always with a reason, always leaving the original row.
3. **Every money or stock change goes through one Postgres function (RPC)** that, in a single
   transaction, writes the business rows, the stock movements, the balanced journal entry and
   the audit log row. The app never inserts into money tables directly. See `04-DATA-MODEL.md`.
4. **Row Level Security on every table.** Access follows the role matrix in `01-PRODUCT.md`.
   Test it: a cashier session must not be able to read payroll.
5. **Multi-tenant from day one:** every row belongs to a `business_id` (and usually a `branch_id`).
6. **Theme via tokens only.** Components read `useTheme()`. Switching a branch between `gents`
   and `ladies` must restyle the whole app with no code changes. Terminology also follows the
   mode (`Barber` vs `Stylist`) — use the `useTerms()` hook, never hardcode.
7. **All user-facing text through i18n keys.** English first; other languages can be machine
   drafts marked `// TODO review` but keys must exist. Layout must work in RTL.
8. **Business date** = the branch's local date. Cash closing, reports and "today" all use it.
9. **No illustrations copied from the reference images.** Use the `<Illustration name=... />`
   placeholder component until licensed artwork is dropped into `assets/illustrations/`.
10. Keep screens thin; logic lives in `src/features/*`. Keep files under ~300 lines.

## Working style

- Start each phase by reading the phase in `05-BUILD-PLAN.md`, then write a short plan
  (files you will touch, migrations you will add) before coding.
- Run `npx tsc --noEmit`, lint and tests before saying a phase is done.
- Commit at the end of each phase with a message like `phase 3: services & customers`.
- Seed data must look real (the demo gents branch "Al Barsha Gents", demo ladies branch
  "Jumeirah Ladies Salon & Spa") so screens can be judged against the reference images.
- When you finish a phase, list: what was built, how to test it on a phone, anything left open.

## Commands (fill in as they are created)

```
npx expo start                 # run app (Expo Go / dev build)
npm run web                    # dev-only browser preview (use it to look at screens)
npx supabase start             # local database (needs Docker running)
npx supabase db reset          # re-run migrations + seed
npx supabase test db           # database tests
npm test                       # app tests
npm run typecheck              # tsc --noEmit
npm run lint                   # eslint (RTL, colour and i18n guards)
npm run format                 # prettier --write
npm run check                  # typecheck + lint + format check + tests — run before finishing a phase
```
