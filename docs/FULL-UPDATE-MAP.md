# Full update — Phase 1 map (25 Oct 2026)

**Repository and hosting.** GitHub `libertylightllc-ctrl/saloon`; Vercel project **saloon**
(libertylightllc-ctrls-projects) builds branch **main** for www.saloqo.com (every push to main deploys to production;
other branches get password-protected previews). Work happens on `website-fixes` (= main + local work), pushed as
`website-fixes:main`. Database: Supabase project `djgxvfbsxnimzblpxcst`; migrations in `supabase/migrations/`.

| What | Where |
|---|---|
| Homepage HTML (static, 7 languages) | `scripts/site/` — `build.mjs` (runs after `expo export` on Vercel), `page.mjs`, `head.mjs` (meta, hreflang, JSON-LD), `sections-top.mjs`, `sections-end.mjs`, `site.css`, `client.js` |
| Homepage words | `src/locales/{en,ar,hi,ur,es,fr,pt}.json` → `auth.landing.*`, `meta.*`, `legal.*` (shared with the app) |
| Owner values (WhatsApp, video, legal name, social…) | `src/config/site.json` (typed in `site.ts`); brand in `src/config/brand.json` |
| Prices | **Database**, `platform_settings` (one row): AED 50 / USD 13.99 per branch, 4 people, extra AED 10 / USD 2.99, `trial_days` 7, `card_payments` live, `bank_transfer` off. The homepage reads it at build time and again in the browser (`client.js`); the app reads it (`src/features/plan/api.ts`, `cardApi.ts`); `plan_price()` in SQL |
| AED / USD switch (homepage) | `scripts/site/page.mjs` (early script): time zone `Asia/Dubai` → `data-uae="1"` at once; then `client.js` asks `/api/geo` (Vercel's `x-vercel-ip-country`) and **the IP country wins** when known (AE → AED). CSS shows `.uae` or `.intl`. The app's own pricing uses the salon's country (`plan_price`: `country_code = 'AE'` → AED) |
| App screenshots on the homepage | `assets/images/landing/*.webp` (600 × 1298) + `assets/site/*-360.webp`; all from UAE demo salons (AED). Capture scripts: `scripts/landing-shots/*.shot.ts` |
| Free trial | `platform_settings.trial_days`; `start_trial()` on salon creation writes `subscriptions(paid_until, trial=true)`; migration 47 |
| Plan / paywall | `subscriptions.paid_until` decides; `plan_status()` for the app; writes check the plan in the database (`salon.plan_check`); an ended plan locks the salon read-only (data kept). App: `src/features/plan/PlanScreen.tsx`, `PlanBanner.tsx`, `storePolicy.ts` (phone apps never show prices) |
| Card payments (Creem) | `supabase/functions/create-checkout` + `creem-webhook` + `_shared/creem.ts` (one product per length 1/3/6/12 months, `custom_price` for the amount); SQL `card_checkout_start()` prices **per salon** (everyone in the salon, × months, no discount); `card_payments` table |
| Bank transfer / request | `request_plan()`, `HowToPay.tsx`; behind `platform_settings.bank_transfer` (off) |
| Admin | The platform console `/console` (`src/features/console/*`), for accounts in `platform_admins` (checked in every admin function): salons, accounts, plan requests and activation, card payments, support chat, closing a salon |
| Receipts | Print the salon's TRN when it has one (`src/features/sales/receipt.ts`) — so "tax receipts with your TRN" is true |

## Where the brief meets what exists (decisions needed)

1. **Prices change shape.** Today: per salon, 1/3/6/12 months, no discount. The brief: per branch, 1/6/12 months
   (6 at 10% off, 12 = pay for 10). Card payments are **live**: if the homepage shows the new prices before the app
   charges them, a 6-month card payment would cost more than the homepage says. → Switch card payments **Off** in the
   console when Phases 2–5 go live (that is also what `BILLING_ENABLED=no` asks), until Phase 6 makes the app charge the
   same.
2. **Admin page.** `/console` already is the admin page, enforced on the server for platform owners. `ADMIN_EMAILS` is
   blank, so I would extend the console (pilot codes, applications, settings, audit) and serve it at `/admin` too,
   for the same platform owners.
3. **Comparison table** ("Many salon apps"). These are claims about other products that the code cannot verify; the
   rules ask for true claims only. I would publish them only if you confirm each row.
4. **Who we are.** `OPERATOR_NAME` is blank: the legal pages keep today's wording until it is set.
