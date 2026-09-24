# Decisions log

One line per decision. Newest at the bottom. Claude Code adds to this when a doc is silent.

- 2026-09-23 · Features come from "Salon Control" (docs/reference/feature-reference.html); look comes from the two reference images.
- 2026-09-23 · One app, two modes per branch: gents (violet) and ladies salon & spa (coral-pink).
- 2026-09-23 · Stack: Expo + React Native + TypeScript + Supabase. Phone first, tablet two-pane for counter screens.
- 2026-09-23 · Multi-tenant from day one (business → branches) so the app can be sold to other salons.
- 2026-09-23 · UAE first (AED, optional 5% VAT, Dubai Municipality compliance, WPS) behind a country profile.
- 2026-09-23 · The staff app only records payment methods; card machines stay separate. Online payments only in the phase 14 customer app.
- 2026-09-23 · WhatsApp receipts start as "share PDF via share sheet"; WhatsApp Business API later.
- 2026-09-23 · Light theme only in v1; tokens are semantic so dark mode can be added.
- 2026-09-23 · Customer booking app is phase 14 and optional.
- 2026-09-24 · Project lives in its own folder and git repo (`~/salon-app`), separate from the old web app in `~/saloon`, which stays untouched.
- 2026-09-24 · Expo SDK 57 (React Native 0.86, React 19.2, TypeScript 6). Needs Node ≥ 20.19.4. Expo Go on the phone must be the SDK 57 build.
- 2026-09-24 · Routes live in root `app/` as CLAUDE.md says (the SDK 57 template default is `src/app`); pinned with the expo-router `root` option in app.json.
- 2026-09-24 · The web target is kept for developer preview only (checking screens in a browser); it is not a product target. On web, RTL flips `<html dir>` instead of reloading.
- 2026-09-24 · Fonts load from the @expo-google-fonts packages (verified: Poppins has Devanagari, IBM Plex Sans Arabic has the Urdu letters). `assets/fonts/` is kept for brand fonts later.
- 2026-09-24 · Money rounding is half away from zero (same as Postgres `round(numeric)`); maths uses BigInt internally. Negative amounts show as `-AED 5.00`. Amount parsing accepts Arabic, Urdu and Devanagari digits; output always uses Latin digits.
- 2026-09-24 · `money.ts` knows GCC currency decimals (AED/SAR/QAR 2, KWD/BHD/OMR 3) so nothing assumes 2 decimals, even though UAE is the only country profile.
- 2026-09-24 · Language is stored on the device (AsyncStorage `settings.language`). First launch uses the phone's language if supported, else English. Switching between LTR and RTL languages reloads the app, with a guard so it can never reload in a loop.
- 2026-09-24 · Machine-drafted ar/hi/ur files carry a top-level `"_review": "TODO review…"` key (JSON has no comments). A test checks all four files have the same keys and placeholders.
- 2026-09-24 · `intl-pluralrules` polyfill added (Hermes lacks full `Intl.PluralRules`; Arabic has six plural forms).
- 2026-09-24 · Lint guards: no left/right styles (use start/end), no hardcoded colours outside `src/theme/`, no raw text in JSX (use `t()`).
- 2026-09-24 · Supabase client is created on first use, so the app opens without a `.env` until phase 2. Auth session in AsyncStorage (Supabase tokens exceed SecureStore's 2 KB limit) — revisit in phase 2.
- 2026-09-24 · The app name is repeated in app.json until phase 13 moves the Expo config to app.config.ts reading `src/config/brand.ts`.
