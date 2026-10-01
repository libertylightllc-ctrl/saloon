# Launch steps that need your accounts

Everything else is built, tested and live at https://saloon-virid.vercel.app. These steps need your own logins, so
they are yours. **You type every password and secret yourself, in the website or your Terminal. Never send them to
anyone, including me.** After each step, tell me "done" and I check and test it end to end.

Supabase project: **Salon Control** (`djgxvfbsxnimzblpxcst`), at https://supabase.com/dashboard.

---

## A · Email sender — most important (15 min)

Without it, sign-up confirmation and password-reset emails only reach your own Supabase team's addresses, so new
salon owners who sign up with email never get the confirmation.

1. Open the Gmail account the emails should come from → https://myaccount.google.com/security → turn on
   **2-Step Verification** if it is off.
2. https://myaccount.google.com/apppasswords → name it `Salon Control` → **Create** → copy the 16-letter password.
3. Supabase → your project → **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**:
   - Sender email: that Gmail address · Sender name: `Salon Control`
   - Host: `smtp.gmail.com` · Port: `465`
   - Username: that Gmail address · Password: the 16-letter app password
   - **Save**.
4. Same section → **Templates → Reset password** → replace everything with the contents of
   `supabase/templates/recovery.html` (in the salon-app folder; ask me and I put it on your clipboard) → **Save**.
   The app asks for the 6-digit code from this email.

(Gmail allows about 500 emails a day. Later, for emails from your own domain such as `hello@yourdomain.com`, use
Resend or Postmark instead — same SMTP page.)

## B · "Continue with Google" (20 min)

1. https://console.cloud.google.com → top bar → **New project** → `Salon Control` → **Create** (select it).
2. **Google Auth Platform → Branding** (or *APIs & Services → OAuth consent screen*): app name `Salon Control`,
   your support email, developer email → save. **Audience**: External → **Publish app** (in "Testing" only listed
   test users can sign in).
3. **Clients → Create client** → *Web application* → name `Salon Control web`:
   - Authorized JavaScript origins: `https://saloon-virid.vercel.app`
   - Authorized redirect URIs: `https://djgxvfbsxnimzblpxcst.supabase.co/auth/v1/callback`
   - **Create** → copy the **Client ID** and **Client secret**.
4. Supabase → **Authentication → Sign In / Providers → Google** → enable → paste the Client ID and secret → **Save**.
5. Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://saloon-virid.vercel.app`
   - Redirect URLs → add `https://saloon-virid.vercel.app/**` and `saloncontrol://auth-callback` → **Save**.

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
  (`com.saloncontrol.app` now; it can never change after the first upload). Tell me if either changes.
- A lawyer reads `/privacy` and `/terms`.
- A native speaker reads the Arabic, Hindi and Urdu texts (machine drafts now).
