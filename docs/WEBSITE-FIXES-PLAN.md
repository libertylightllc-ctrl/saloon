# Website fixes — plan (brief: SALOQO_WEBSITE_FIXES.md, 22 Oct 2026)

Branch `website-fixes`. Stack checked: Expo SDK 57 web, Expo Router, React Native Web, `"web": { "output": "single" }`
(one HTML page, `public/index.html`), i18next with 7 locale files (`src/locales/*.json`, parity test), layout from the
window width (`useLandingLayout`, `useWindowDimensions`). Visitor country: `src/lib/geo.ts` (`visitorCountry`, used by
the pricing card). Owner-only values: new `src/config/site.ts` (0.4), empty defaults, elements hidden while empty.

## Phase 1 — bugs and quick fixes

| Item | Files |
|---|---|
| 1.1 `%WEB_TITLE%` | `public/index.html` (title and `apple-mobile-web-app-title` → Saloqo) |
| 1.2 Page titles | new `src/lib/pageMeta.ts` (`usePageMeta(title, description)`: document title + meta description on web); used in `app/(auth)/welcome.tsx`, `sign-up.tsx`, `sign-in.tsx`, `src/features/booking/BookingScreen.tsx`; keys `meta.*` in 7 locales |
| 1.3 Reports picture | `assets/images/landing/gents-reports.webp` is a real app screenshot (the seed salon's losing October). New capture from a demo salon with healthy numbers (Sales ≈ AED 48,250, Costs ≈ 31,400, Result +16,850, compliance 0, last close balanced): one-off capture script `scripts/landing-shots/reports.spec.ts` (Playwright on the local stack) → 600 × 1298 WebP |
| 1.4 Sign-up back arrow | `app/(auth)/sign-up.tsx` (back: history, else `/welcome`); `app/(auth)/welcome.tsx` (push instead of replace, so history exists) |
| 1.5 Sign-up → sign-in link | `app/(auth)/sign-up.tsx` (+ key `auth.signUp.haveAccount`) |
| 1.6 No salon-type toggle on sign-in | `src/features/auth/AuthShell.tsx` (`showTypeSwitch` prop, off on sign-in and forgot-password; sign-up keeps it until 3.5) |
| 1.7 Contact us as a real link | new `src/features/landing/contact.ts` (WhatsApp if `site.whatsappNumber`, else `mailto:`) + `ExternalLink` in `src/features/landing/parts.tsx` (renders `<a href>`); `Closing.tsx` footer and `AuthShell.tsx` "Need help?" The visitor chat at `/contact` stays reachable as its own footer link ("Chat with us") |

## Phase 2 — homepage (`/welcome`)

Files: `src/features/landing/Hero.tsx`, `FeatureBento.tsx`, `OwnerBenefits.tsx`, `TypeChoice.tsx`, `Pricing.tsx`,
`Closing.tsx`, `parts.tsx`, `app/(auth)/welcome.tsx`, new `KeepYourApp.tsx` (2.7), `SocialProof.tsx` (2.8),
`DemoVideo.tsx` (2.9), `Faq.tsx` (2.10, with FAQPage JSON-LD), `StickyBar.tsx` (2.3, 2.4), `bookingMock` image (2.6,
captured like 1.3), `src/config/site.ts`, locales. 2.12 uses `visitorCountry()` as the pricing card does. 2.14
(≥30% shorter at 390 px): swipe row for the 6 cards, compact 01/02/03 list, smaller gaps; measured before/after.

## Phase 3 — sign-up and sign-in

`app/(auth)/sign-up.tsx`, `sign-in.tsx`, `src/features/auth/AuthShell.tsx` (panel per page), `SignUpDone.tsx`,
`api.ts` (`signUpOwner`), `src/features/setup/SetupWizard.tsx` + `ModeCard.tsx` (3.5: salon type in setup),
migration for the WhatsApp number + consent (3.3) on the owner's profile (`members` or a new `owner_contacts` table,
shown in the console's Accounts tab), privacy policy text (3.3). **3.4 needs your OK**: signing owners in before they
confirm their email means turning off "Confirm email" in Supabase Auth (a security setting) and checking
confirmation before a plan is bought.

## Phase 4 — Google, speed, technical

**4.1 approach (needs your OK before I build it):** keep the app as it is (single-page) and add pre-rendered
marketing pages: a small build step renders `/welcome` (and the language versions, 4.2) to real HTML with React
Native Web's server rendering, served by Vercel at `/` for signed-out visitors (a Vercel rewrite plus a cookie the app
sets on sign-in, so signed-in owners still land in the app). Switching the whole app to Expo's `static` output is the
alternative; it touches every route and the sign-in gate, so I'd only do it if you prefer it.
4.2–4.6 follow from 4.1 (`hreflang`, `sitemap.xml`, `robots.txt`, JSON-LD, OG image 1200 × 630, code splitting,
WebP sizes, accessibility). **4.7:** there is no analytics in the app today — tell me which one to add (Vercel Web
Analytics is the simplest, no cookies); I won't add a tracker without your OK.

## Phase 5 — each item waits for your approval

5.1 booking page (logo is already shown; address/hours/map partly), 5.2 legal names from config, 5.3 bank-transfer
option behind a flag, 5.4 more salon types (plan first).
