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
