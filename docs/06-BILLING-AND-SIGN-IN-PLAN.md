# 06 — Plan: paid plans, and sign-up emails / Google sign-in

Status: **decided 2026-09-29 and built** (card payments later):
- Sign-in: **Continue with Google** + an email sender (owner sets both up in Supabase — see HOSTED-SUPABASE.md §7–8).
- **No trial**: sign up and set up for free; the features need an active plan.
- **AED 99 per branch per month** (`platform_settings.price_per_branch_minor`).
- Payment provider: **decide later**. Until then the owner asks for a plan in the app (More → Plan & billing) and the
  platform owner records the payment (More → Salons & plans), which switches the plan on for 1–12 months.

The rest of this page is the original proposal, kept for the card-payment step.

## A. Sign-up emails and "Sign in with Google"

Today an owner signs up with email + password and must click a confirmation email. Supabase's built-in mailer only
delivers to the addresses on your Supabase team, a few per hour, so other people never receive it. Staff are not
affected (they sign in with a username the owner creates; no email).

| Option | What people see | What you set up (you type any secrets yourself) |
|---|---|---|
| **1. Continue with Google** (recommended, first) | A "Continue with Google" button: one tap with their Gmail, no password, no confirmation email. | Google Cloud → OAuth client (web + Android + iOS). Paste its client ID and secret into Supabase → Authentication → Providers → Google. I add the button and the phone redirect. |
| **2. An email sender** (needed anyway) | Confirmation and password-reset emails arrive for any address. | Quick: Gmail SMTP with a Google *app password* (up to ~500 emails a day, sent from your Gmail). Proper: Resend / Postmark with your own domain (e.g. `hello@yoursalonapp.com`). Entered in Supabase → Authentication → Emails → SMTP. |

Recommendation: both. Google sign-in for most owners; an email sender for everyone else and for password resets.

## B. Anyone can sign up; using the app needs a paid plan

### How it works for the salon
1. The owner signs up and sets up the salon (free).
2. ❓ **Free trial**: recommended **14 days** with everything on (people buy what they have tried).
3. After the trial the salon needs an active plan. Without one:
   - the owner and the accountant can still **sign in, see everything and export / back up** (their data is never held hostage),
   - nobody can add new queue entries, sales, expenses, stock moves, payroll… (every "write" is refused),
   - Home shows "Your plan has ended — choose a plan" (owner) or "Ask the owner to renew" (staff).
4. A failed card payment gives **7 days' grace** with a warning banner before writes stop.
5. Nothing is ever deleted because a plan ended.

### ❓ Prices (proposal — change freely)
| Plan | Per month | Per year (2 months free) | Includes |
|---|---|---|---|
| **Salon** | AED 149 per branch | AED 1,490 per branch | everything: queue, sales, cash closing, stock, staff & payroll, compliance, reports, all roles and languages |

One plan, priced per branch, is the simplest to sell and to build. Tiers (e.g. a cheaper plan without payroll and
compliance, or a staff-login limit) can be added later without changing the design.

### ❓ Payment provider
**Recommended: Stripe** — available to UAE companies, charges in AED, cards + Apple Pay / Google Pay, handles the
monthly renewals, failed-payment retries, invoices and a ready-made "manage / cancel my plan" page. Needs a UAE
trade licence and a bank account to verify. Local alternatives (Tap, Telr, N-Genius) work but make renewals more work.

### Phones and the app stores
Apple and Google take 15–30% and require their own in-app purchase for subscriptions *bought inside the app*. So:
**plans are bought on the website** (the Vercel link); the phone apps show the plan status and a "Manage plan"
link. This is the usual set-up for business software; if a store reviewer objects, in-app purchase can be added
later (RevenueCat) without changing the rest.

### What gets built (one milestone, with tests like every other)
- **Database:** a `subscriptions` row per salon (plan, status: trialing / active / past_due / ended, trial end, paid-until,
  branches, Stripe ids). Only the payment webhook writes it; the owner reads it.
- **Enforced in the database, not just the app:** every money / stock / queue function first checks
  `plan_active(salon)` and refuses with `plan_required` otherwise — so it cannot be bypassed.
- **Server functions:** `billing-checkout` (opens Stripe's payment page for the owner's salon), `billing-portal`
  (manage / cancel / invoices), `stripe-webhook` (Stripe tells us a payment succeeded, failed or was cancelled; its
  signature is checked).
- **App:** More → **Plan & billing** (status, days left, choose plan, pay, manage); trial and payment banners on Home;
  a clear locked state when the plan has ended.
- **Tests:** SQL tests that every write is refused without a plan and allowed with one; end-to-end with Stripe's test
  mode (test card 4242…), including a failed payment and the grace period.

### What I need from you
1. ❓ Trial length and prices (or "use the proposal").
2. A Stripe account (verified with the trade licence). Then you run, in the Terminal, one command I give you to store
   the Stripe secret key in Supabase — **you type the key; never send it to me.**
3. Whether you charge VAT on the plan (if the company is VAT-registered, Stripe adds 5%).
