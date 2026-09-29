# Phone builds and the app stores (EAS)

The app is ready to build with Expo's build service (EAS). Building and publishing needs **your own accounts**,
so these steps are yours to run. Nothing here needs you to send anyone a password or a key.

> **Never send anyone** (including me) your Apple or Google password, your Expo password, the Supabase
> `service_role` key, or the database password. The only Supabase values an app build needs are the
> **Project URL** and the **anon (public) key** — both are meant to be public.

## What you need first

| Account | Cost | Needed for |
|---|---|---|
| Expo account (expo.dev) | free | every build |
| Google Play Console | USD 25 once | Android store listing (test APKs do not need it) |
| Apple Developer Program | USD 99 / year | any iPhone build, TestFlight and the App Store |

And the hosted Supabase project from `docs/HOSTED-SUPABASE.md` (the phones need a database on the internet).

## 1 · Connect the project to your Expo account (once)

```bash
npx eas login
```

```bash
npx eas init
```

`eas init` prints a **project ID**. Save it as a build variable so the app can receive push notifications:

```bash
npx eas env:create --environment preview --environment production --name EAS_PROJECT_ID --value <the project ID> --visibility plaintext
```

## 2 · Tell the builds where the database is (once)

Use the Project URL and anon key from Supabase → Project Settings → API:

```bash
npx eas env:create --environment preview --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<your-project>.supabase.co --visibility plaintext
```

```bash
npx eas env:create --environment preview --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
```

## 3 · A test build on your Android phone

```bash
npx eas build --profile preview --platform android
```

When it finishes (10–20 minutes) EAS shows a link and a QR code. Open it on the phone and install the APK
(Android asks you to allow installs from the browser once). Then follow `docs/PHONE-TEST.md`.

## 4 · A test build on an iPhone

Register each test iPhone once (it opens a page on the phone to install a profile):

```bash
npx eas device:create
```

```bash
npx eas build --profile preview --platform ios
```

EAS asks to sign in to your Apple Developer account and creates the certificates for you.

## 5 · Push notifications on real phones

- **iPhone:** EAS sets up the Apple push key during the iOS build (answer "yes" when it asks).
- **Android:** create a Firebase project, add an Android app with the package `com.saloncontrol.app`,
  download its service-account key (Project settings → Service accounts), then upload it:

```bash
npx eas credentials --platform android
```

(choose *Google Service Account → Push notifications (FCM V1)* and pick the downloaded JSON file.)

## 6 · Store builds and submission

```bash
npx eas build --profile production --platform all
```

```bash
npx eas submit --platform android
```

```bash
npx eas submit --platform ios
```

Store listings (screenshots, description, privacy answers) are filled in on Google Play Console and App Store
Connect. The screenshots in `e2e-results/screens/` (made by the test suite for both salon types) are a good start.

## Things that are fixed once the app is in a store

- The identifier `com.saloncontrol.app` (in `src/config/brand.ts`). Change it **before** the first upload if
  the final brand name is different; after that it can never change.
- The app name can change later (brand.ts `appName`), with a new build.
