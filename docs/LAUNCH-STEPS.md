# Launch steps that need your accounts

Everything else is built, tested and live at https://www.saloqo.com. These steps need your own logins, so
they are yours. **You type every password and secret yourself, in the website or your Terminal. Never send them to
anyone, including me.** After each step, tell me "done" and I check and test it end to end.

Supabase project: **Salon Control** (`djgxvfbsxnimzblpxcst`), at https://supabase.com/dashboard.

---

## 0 · Point saloqo.com at the website (5 min, once)

The domain is bought at Hostinger and already added to the website project on Vercel. Hand its DNS to Vercel, so
the site answers at saloqo.com and every later record (email sender, Google) can be set from here without you:

1. https://hpanel.hostinger.com → **Domains** → `saloqo.com` → **DNS / Nameservers** → **Change nameservers**.
2. Choose **custom nameservers** and enter `ns1.vercel-dns.com` and `ns2.vercel-dns.com` (remove any others) → **Save**.
3. Wait (usually under an hour, at most a day). https://saloqo.com then opens the app with its own secure padlock
   (it moves to **www.saloqo.com**, the main address). ✅ Done 2026-10-03.

## A · Email sender — ✅ done 2026-10-03 (Resend, no-reply@saloqo.com; sign-up and reset emails tested)

Without it, sign-up confirmation and password-reset emails only reach your own Supabase team's addresses, so new
salon owners who sign up with email never get the confirmation. With saloqo.com, the app sends from
`no-reply@saloqo.com` through **Resend** (free plan to start), and I add Resend's DNS records for you.

1. https://resend.com → sign up → **Domains → Add domain** → `saloqo.com` → **Add**. Resend lists a few DNS records.
2. **Tell me "Resend domain added"** — I read nothing from your account; just copy the record list from that page
   into the chat (names and values are public DNS records, not secrets) and I add them in Vercel DNS.
3. Back in Resend → the domain → **Verify** (a few minutes after I add the records).
4. Resend → **API Keys → Create API key** (permission: *Sending access*). Copy it — it is a secret: **do not send it
   to me**; paste it only in the next step.
5. Supabase → your project → **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**:
   - Sender email: `no-reply@saloqo.com` · Sender name: `Saloqo`
   - Host: `smtp.resend.com` · Port: `465`
   - Username: `resend` · Password: the API key from step 4
   - **Save**.
6. Same section → **Templates → Reset password** → replace everything with the contents of
   `supabase/templates/recovery.html` (ask me and I put it on your clipboard) → **Save**.

**Receiving mail at support@saloqo.com** (for customers to write to): the simplest is free forwarding to your Gmail
with a forwarding service such as ImprovMX — sign up, add `saloqo.com`, forward `support@` to your Gmail, and send me
the MX/SPF records it shows; I add them. (A full mailbox — Google Workspace or Zoho — works too; same: send me its
records.)

## B · "Continue with Google" — ✅ done 2026-10-03 (tested end to end)

1. https://console.cloud.google.com → top bar → **New project** → `Saloqo` → **Create** (select it).
2. **Google Auth Platform → Branding** (or *APIs & Services → OAuth consent screen*): app name `Saloqo`,
   your support email, developer email → save. **Audience**: External → **Publish app** (in "Testing" only listed
   test users can sign in).
3. **Clients → Create client** → *Web application* → name `Saloqo web`:
   - Authorized JavaScript origins: `https://www.saloqo.com` and `https://saloqo.com`
   - Authorized redirect URIs: `https://djgxvfbsxnimzblpxcst.supabase.co/auth/v1/callback`
   - **Create** → copy the **Client ID** and **Client secret**.
4. Supabase → **Authentication → Sign In / Providers → Google** → enable → paste the Client ID and secret → **Save**.
5. Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://www.saloqo.com`
   - Redirect URLs → add `https://www.saloqo.com/**`, `https://saloqo.com/**` and `saloqo://auth-callback` → **Save**.

The "Continue with Google" button then appears on the sign-in and sign-up pages by itself.

## C · Your details (2 min)

Send me: **your company's legal name** and **a support email** for customers. I put them in
`src/config/brand.json`; the privacy policy, terms and landing page then show your contact line.

## D · Expo account — for the phone apps (5 min)

1. https://expo.dev/signup → create the account → confirm the email.
2. In Terminal:

```bash
cd ~/salon-app
```

```bash
npx eas login
```

(type your Expo password there). Tell me, and I connect the project and make an **Android test build** you install
from a link.

## E · Apple Developer — iPhone app (USD 99 / year; Apple takes days to approve)

1. Apple ID with **two-factor authentication** on (a company email if you can).
2. Company enrolment needs a **D-U-N-S number**: https://developer.apple.com/enroll/duns-lookup (legal name and
   address exactly as on the trade licence). This is the slow part; start it first. A single-person trade licence
   enrols as Individual instead (no D-U-N-S).
3. https://developer.apple.com/programs/enroll → fill in → pay.
4. When approved, tell me. The iPhone build asks you to sign in to Apple in your Terminal (you type the password and
   code there).

## F · Google Play — Android store (USD 25 once)

https://play.google.com/console/signup → organisation account → pay → identity verification (Google asks for
documents; takes a few days). Tell me when it is approved.

## G · Before the stores

- Decide the final **app name** (search the App Store and Play Store: it must not be taken) and the app ID
  (`com.saloqo.app` now; it can never change after the first upload). Tell me if either changes.
- A lawyer reads `/privacy` and `/terms`.
- A native speaker reads the Arabic, Hindi and Urdu texts (machine drafts now).

## H · Getting paid by salons (10 min)

Salons see **How to pay** on their Plan page (website), pay you, and tap **Ask to switch on**; you get an email and
switch their plan on. Card payments inside the app come later.

1. **Be the platform owner on the live site.** Tell me the email you signed in with on www.saloqo.com; I add it once.
   You then have **More → Salons & plans**.
2. **Your payment details** (you type them; salons see them): More → Salons & plans → **Payment details** → bank,
   account name, IBAN, SWIFT, and/or a card payment link (for example a Stripe Payment Link, PayPal, Ziina or
   Network International pay-by-link) → **Save**.
3. **Email alerts.** https://resend.com → **API Keys → Create API key** (Sending access) → copy it. It is a secret:
   **do not send it to me.** In Terminal:

```bash
cd ~/salon-app
```

```bash
npx supabase secrets set RESEND_API_KEY=PASTE_THE_KEY_HERE --project-ref djgxvfbsxnimzblpxcst
```

   (replace `PASTE_THE_KEY_HERE` with the key before pressing Enter). From then on every request emails the platform
   owner's sign-in address; requests made before that are emailed within 10 minutes.
4. When the money arrives: More → Salons & plans → the salon → **Record payment**. Their plan starts at once.

## I · Privacy for the EU, the UK and Brazil (before signing up salons there)

The privacy policy and terms now have GDPR (EU and UK) and LGPD (Brazil) wording, in every app language — drafts a
lawyer should check. These details are yours to supply; put them in `src/config/brand.json` and they appear on both
pages in every language:

1. **`legalName` and `address`** — the company that runs Saloqo (as on its trade licence). GDPR requires them.
2. **`privacyEmail`** (or a real `supportEmail`) — today it is `support@example.com`, so the pages show no contact at
   all. One real address, read regularly, e.g. privacy@saloqo.com. It is also the Brazil "encarregado" contact.
3. **EU and UK representatives** (`euRepresentative`, `ukRepresentative`) — a company outside the EU/UK that serves
   salons there must name one (GDPR article 27). Services such as Prighter, DataRep or VeraSafe do this for roughly
   EUR 100–500 a year each. Enter their name and address once appointed.
4. **Sign the providers' data processing agreements** (the policy says transfers are covered by them):
   Supabase → Dashboard → Organization → Legal documents → DPA; Vercel → its DPA (vercel.com/legal/dpa);
   the email provider (Resend or whichever sends sign-up emails) and Expo (expo.dev/privacy) likewise.
5. **Lawyer review** — ask an EU data-protection lawyer (one review covers the UK too) and a Brazilian one to check
   `legal.privacy.*` and `legal.terms.processing` (English in `src/locales/en.json`; all languages in
   `docs/translation-review.csv`). Confirm the 48-hour breach notice to salons and the response times suit you.
6. Data is stored in **South Korea** (Supabase, Seoul). The EU and the UK recognise Korea as adequate, so no extra step
   is needed for that; a lawyer may still suggest an EU region later for speed and comfort.

## J · Your dev account (the platform console)

1. Sign up on saloqo.com with the email you want as the dev account (no salon is needed — skip the setup).
2. An existing platform owner adds it: **More → Platform console → Accounts → Platform owners** → type the email →
   **Make platform owner**. Today the only platform owner is the Demo Shop owner's account, so add the dev account
   **before** deleting Demo Shop.
3. Sign in with the dev account → **Open the platform console**.
