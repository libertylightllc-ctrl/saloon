# Moving from the local database to hosted Supabase

Today the app talks to a database on this Mac (`npx supabase start`). Phones on the same Wi-Fi reach it
through the Mac's network address. To use the app away from this Mac, the database has to live on
Supabase's servers. This is a one-time setup of about 20 minutes.

> ## ⚠️ Never send these to anyone — not to me, not in chat, not in email
> - the **`service_role` key** (Supabase also calls it the **secret key**, starts `sb_secret_…` or is a long `eyJ…` marked *service_role*)
> - the **database password** you choose when creating the project
>
> Either one gives full control of every salon's data, bypassing all security rules.
> The app never needs them, and I never need them. If one is ever exposed, rotate it at once
> in the Supabase dashboard (Project Settings → API / Database).

## 1. What you create (you, in the browser)

1. Sign in at **supabase.com** and click **New project**.
2. **Name:** `salon-control` (any name works).
3. **Database password:** press *Generate*, then save it in your password manager. **Keep it to yourself.**
4. **Region:** the one closest to the UAE that Supabase offers (a Middle East region if listed,
   otherwise Mumbai `ap-south-1`).
5. **Plan:** Free is fine for testing. Use Pro before real salons rely on it: it has daily backups
   and no pausing after a week of inactivity.

## 2. The two values to send me

In the new project open **Project Settings → API** (or **Connect → App Frameworks**) and copy:

| Send me | Looks like | Safe to share? |
|---|---|---|
| **Project URL** | `https://abcdefghijkl.supabase.co` | Yes |
| **anon / publishable key** | `sb_publishable_…` or a long `eyJ…` marked **anon public** | Yes, it is built into the app and protected by the security rules |

That's all. Do **not** send the `service_role` / secret key or the database password.

## 3. Linking this Mac to the project (you type the password, not me)

In a terminal in the project folder:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref abcdefghijkl
```

`login` opens the browser. `link` asks for the **database password**: type it there yourself. After
that the tools on this Mac can update the hosted database, and I never see the password.

## 4. What I then do (no secrets needed)

1. `npx supabase db push`: creates all tables, security rules and functions (`supabase/migrations`).
2. `npx supabase functions deploy create-staff-login manage-staff-login`: the staff-login functions.
   Supabase gives functions their own service key automatically; it never leaves Supabase.
3. **Auth settings** (dashboard → Authentication):
   - *URL configuration:* Site URL `saloncontrol://` (the app) and your web address if you use the web build.
   - *Email templates → Reset password:* the 6-digit code template from `supabase/templates/recovery.html`.
   - *Email:* keep **Confirm email** on for owner sign-ups (the app already says "check your email").
   - *SMTP:* connect a mail provider (for example Resend or Postmark). Supabase's built-in mailer
     only sends a few emails an hour and is not meant for real use.
4. Put your two values in `.env` (git-ignored):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijkl.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<the anon / publishable key>
   ```
5. Re-run the end-to-end tests against the hosted project before any salon uses it.

**Not done on hosted:** `supabase/seed.sql`. It creates the two demo businesses with known demo
passwords. It is only for the local database.

## 5. Switching back to local

Set `EXPO_PUBLIC_SUPABASE_URL=auto` and the local anon key (from `npx supabase status`) in `.env`,
then restart `npx expo start`.

## 6. Going live on the Vercel link (replacing the old app)

Agreed on 2026-09-26: new Supabase project (the old project `vmoocchjtlpggnoadpio` and its data stay untouched),
`main` of `libertylightllc-ctrl/saloon` gets the new app in one new commit (old version kept under the tag `v1-web`),
and nothing is pushed until the hosted database is ready.

Already prepared (local, not pushed):
- `vercel.json`: builds the website with `expo export` into `dist/` and sends every path to the app.
- `scripts/check-web-env.mjs`: the Vercel build **stops** unless a hosted Supabase URL and anon key are set, so the
  live link can never show a sign-in that does not work.
- Branch `ready-for-main` (= the new app + the old history as a parent) and tag `v1-web` (= today's live commit
  `7c93ae6`). Pushing them is a normal fast-forward; nothing is force-pushed.
- The full e2e suite passes against the production website build served the way Vercel serves it (34/34).

Order on the day:
1. You: create the project, then `npx supabase login` and `npx supabase link --project-ref <ref>` (you type the
   database password). Send me the Project URL and the anon / publishable key.
2. Me: `npx supabase db push`, deploy the two Edge Functions, set the auth settings (site URL = the Vercel link,
   6-digit recovery template, confirm email on, SMTP as you choose).
3. Me: put the two public values where the Vercel build reads them — either a committed `.env.production`
   (they are public by design) or you add `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` under
   Vercel → Project → Settings → Environment Variables.
4. Me: a smoke test against the hosted project (sign up, setup, a sale, Accounts balanced), then
   `git push origin v1-web` and `git push origin ready-for-main:main`. Vercel deploys the new app.
5. Rolling back is one command away: `git push origin v1-web^{commit}:main --force-with-lease` would put the old app
   back (only if ever needed, and only with your go-ahead).

Side effects to expect: the old repo's GitHub Actions (`pages.yml` for GitHub Pages, `mobile.yml` for Android
builds) are not part of the new app, so they stop running; the last GitHub Pages deployment stays online until
disabled in the repo settings.
