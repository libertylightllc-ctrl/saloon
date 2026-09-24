# 02 — Design system

The app must look like the two reference images, not like the feature-reference dashboard.

- `docs/reference/gents-style.jpeg` → **gents theme** (violet "Barber" booking kit)
- `docs/reference/ladies-style.jpeg` → **ladies theme** (coral-pink "Fashly" concept)

Open the images and compare side by side whenever you build a component. Hex values below were
picked from the images; if a component looks off next to the reference, adjust the token, not the component.

Both themes share the same structure (spacing, type scale, component API). They differ in
colour, a few shape details and how headers, category icons and promo banners are drawn.

## 1. Tokens

`src/theme/tokens.ts` exports the shared scale; `gents.ts` and `ladies.ts` export a `Theme` object with
the same keys. Components only use semantic names (`colors.primary`, `colors.textSecondary` …).

### 1.1 Colour — gents (violet)

| Token | Hex | Use |
|---|---|---|
| `primary50` | `#F4F1FF` | Screen tint, soft chips, "Book now"-style tinted buttons |
| `primary100` | `#E8E1FF` | Borders on tinted elements, selected row |
| `primary200` | `#CFC2FF` | Dividers on violet surfaces |
| `primary300` | `#AE97FF` | Header contour-line pattern |
| `primary400` | `#8C6CFA` | Hover / focus ring |
| `primary500` | `#6C45F2` | **Main** — header band, buttons, active tab (white text 5.6:1 ✓) |
| `primary600` | `#5A32DE` | Pressed |
| `primary700` | `#4724B5` | Text on tinted chips |
| `background` | `#F7F5FF` | App background (very light lavender) |
| `surface` | `#FFFFFF` | Cards, sheets, tab bar |
| Category pastels | `#FFE4EC` `#EDE7FF` `#FFEBD9` `#FFF6D6` `#E0F4FF` | Round category icons cycle through these (as in the Barber kit's Hair Cut / Shave / Makeup / Nail row) |
| Category icon colours | `#F0507A` `#6C45F2` `#F28A2E` `#E0A800` `#1E90D6` | Icon stroke on the pastel above |

### 1.2 Colour — ladies (coral-pink)

| Token | Hex | Use |
|---|---|---|
| `primary50` | `#FFF3F2` | Card tint, list thumbnails background |
| `primary100` | `#FDE1E0` | Soft chips, category circles, offer strip |
| `primary200` | `#FBC4C3` | Borders, progress dashes (inactive) |
| `primary300` | `#F8A2A2` | Illustration accents |
| `primary400` | `#F58B8C` | Hover / focus ring |
| `primary500` | `#F2777A` | **Brand coral** — wordmark, active pill, stepper outline, icons, progress dash |
| `primaryAction` | `#E0606A` | Filled buttons with white label (slightly deeper than brand coral for legibility; set it to `#F2777A` for the exact reference look) |
| `primary600` | `#D14F5A` | Pressed |
| `primary700` | `#B8464B` | Coral text on light backgrounds (4.8:1 ✓) |
| `accentLavender` | `#B892DB` | Secondary accent (spa, bridal) |
| `background` | gradient `#FBE7E1` → `#F6EAF1` → `#ECDDF3` (top-left to bottom-right) | Auth / onboarding screens and screen backgrounds behind cards |
| `backgroundFlat` | `#FFF7F5` | Plain screens where a gradient would be busy (lists, forms) |
| `surface` | `#FFFFFF` | Cards, sheets |

### 1.3 Shared neutrals (from the Barber kit's grey scale)

| Token | Hex | Use |
|---|---|---|
| `n20` | `#F2F3F8` | Input fill, skeletons |
| `n30` | `#EFEFEF` | Dividers |
| `n40` | `#E1E1E1` | Borders |
| `n50` | `#BEBEBE` | Disabled borders |
| `n60` | `#9F9F9F` | Placeholders, disabled text only (not for real text) |
| `n70` | `#767676` | Secondary text (4.5:1 ✓) |
| `n80` | `#626262` | Body text on tinted surfaces |
| `n90` | `#3D3D3D` | Strong secondary |
| `n100` | `#222222` | Primary text, headings |

### 1.4 Semantic (from the Barber kit's semantic sheet; error added)

| | main | surface | border | hover | pressed |
|---|---|---|---|---|---|
| success | `#00BF71` | `#CCF2E3` | `#AAEAD0` | `#009F5E` | `#006038` |
| info | `#0C61F7` | `#CEDFFD` | `#AECAFC` | `#0A51CE` | `#06307C` |
| warning | `#F2C94C` | `#FCF4DB` | `#FBEDC3` | `#CAA73F` | `#796425` |
| error | `#E5484D` | `#FDE8E8` | `#F9C5C6` | `#C93B40` | `#7A1F22` |

Status pills use **surface background + pressed-colour text** (white text on the main colours fails contrast).

| Status | Colour set |
|---|---|
| Waiting | warning |
| In progress | info |
| Booked | theme primary (`primary50` bg, `primary700` text) |
| Completed / Paid / Approved / Valid | success |
| No-show / Overdue / Expired / Out of stock | error |
| Pending approval / Due soon / Low | warning |
| Cancelled / Reversed / Archived | neutral (`n20` bg, `n80` text) |

### 1.5 Typography

One family for Latin and Devanagari: **Poppins** (it includes Devanagari, so Hindi works).
Arabic and Urdu: **IBM Plex Sans Arabic**. Load with `expo-font`; pick family by current language.

Scale (mobile version of the Barber kit's type sheet — Big title 50/65, H1 30/45 … scaled for phones):

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `display` | 28 / 36 | Bold | Greeting, big money amounts on KPI hero |
| `h1` | 24 / 32 | Bold | Screen titles on header band |
| `h2` | 20 / 28 | Bold | Section titles, onboarding titles ("Schedule your time") |
| `h3` | 18 / 26 | SemiBold | Card titles |
| `h4` | 16 / 24 | SemiBold | List row titles, button labels |
| `body` | 14 / 20 | Regular | Body |
| `bodyStrong` | 14 / 20 | Medium | Prices, emphasised values |
| `small` | 12 / 16 | Regular | Meta lines (address, duration, "waiting 6 min") |
| `micro` | 10 / 14 | Medium | Tab bar labels, category labels under circles |

Money and counts use tabular figures (`fontVariant: ['tabular-nums']`). Sentence case everywhere — no all-caps
labels. The only all-caps text is a wordmark/logo if the brand uses one.

### 1.6 Spacing, radius, elevation

- Spacing (4-pt grid): `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32 · 4xl 40`. Screen side padding **20**.
- Radius: `sm 8` (chips, small buttons, thumbnails in ladies) · `md 12` (inputs, buttons, list thumbnails) ·
  `lg 16` (cards) · `xl 28` (header band bottom corners, bottom sheets) · `pill 999`.
  Ladies buttons use `10`, gents buttons `12`.
- Shadows are **tinted**, never plain grey:
  gents `0 6 16 rgba(108,69,242,0.08)` · ladies `0 6 16 rgba(242,119,122,0.10)`. Cards on white surfaces use a
  1-px border (`n30`) instead of a shadow.
- Tap targets ≥ 44 × 44.

## 2. Signature differences between themes

| Element | Gents (violet) | Ladies (coral) |
|---|---|---|
| Screen header | **Violet band** (`primary500`), white title, 28-px rounded bottom corners, faint contour-line pattern (`primary300` at 35%) — like the Barber kit's Profile and Sign Up screens | **Light header** on blush/white, dark title centred, back button is a small **filled coral rounded square** with a white chevron — like Fashly's "Services" screen |
| Back button | White circle with dark arrow on light screens; white arrow on the band | Coral 32-px rounded square, white chevron |
| Home top | Avatar + name + location line, bell on the right; pill search bar with a violet round filter button | Wordmark left ("FASHLY"-style bold coral caps → our brand), search + bell + avatar icons right |
| Promo / highlight banner | Violet card, white text, white pill "Explore" button, illustration on the right | Photo-style coral/blush card, dark heading ("50% off"), white rectangular "Book now" button |
| Category row | 56-px circles, **multicolour pastels** (see 1.1), coloured line icon, micro label | 56-px circles, **single coral tint** (`primary100`), coral icon, micro label |
| Segment tabs | Underline or white-on-violet tabs on the band (About / Services / Gallery / Reviews) | **Pill tabs**: active = coral fill + white text, others plain text (Popular / Facial / Hair) |
| List row action | Tinted pill button (`primary50` bg, `primary500` text) — "Book now" | Outlined coral small button "ADD" → becomes an outlined stepper "– 1 +" |
| Primary button | Full width, 52 high, radius 12, violet | Full width, 48 high, radius 10, coral (`primaryAction`) |
| Onboarding | Violet band illustration pages | White card over blush gradient, illustration top, title + subtitle, **progress dashes** (active long coral dash) and small "Next" button bottom-right |
| Bottom tab bar | White, 5 items, active = violet icon + label + small dot/bar above | White, 5 items, active = coral icon + label |

Implement these as theme-driven variants of the same component (e.g. `HeaderBand` reads `theme.header.style: 'band' | 'light'`),
never as two separate component trees.

## 3. Components (`src/ui/`)

Build each with both themes and show them in a **Theme gallery** screen (`/dev/gallery`, dev builds only)
with a toggle to flip gents/ladies and LTR/RTL. This screen is how the owner signs off the look.

| Component | Notes |
|---|---|
| `Screen` | Safe area, background (flat or gradient per theme), keyboard avoiding, pull-to-refresh option |
| `HeaderBand` | Variant per theme (section 2). Props: title, subtitle, back, right actions, children (overlapping card) |
| `BackButton` | Per theme |
| `Button` | `primary`, `secondary` (tinted), `outline`, `ghost`, `danger`; sizes `lg` (full width) / `md` / `sm`; loading state |
| `IconButton` | Round (gents) / rounded-square (ladies) |
| `TextField` | Label above, 48 high, `n20` fill or white with `n40` border, focus ring `primary400`, error text below |
| `SearchBar` | Pill; optional filter button on the right |
| `MoneyInput` | Currency prefix, numeric keypad, stores minor units |
| `Card` | Radius 16, tinted shadow or border |
| `KpiCard` | Label, big value, delta chip (▲ 12% success / ▼ error), sub-line |
| `ListRow` | Thumbnail/avatar left, title, meta line(s), right slot (price, pill, action button, chevron) |
| `MenuRow` | Icon in a small pastel rounded square, label, chevron — the Barber kit's Profile list |
| `CategoryCircle` | 56-px circle + micro label, per-theme colouring |
| `PillTabs` / `SegmentTabs` | Scrollable; theme variant |
| `StatusPill` | From the status table in 1.4 |
| `Avatar` | Initials on a colour derived from the employee colour / name; image when available |
| `Stepper` | "– 1 +" outlined; used in Quick Sale |
| `PromoBanner` | Per theme (section 2); used for setup progress and "Needs attention" highlight |
| `ProgressDashes` | Onboarding & setup wizard |
| `DateStrip` / `MonthSwitcher` | "August 2022" style pill with round arrow buttons (Barber kit "Select Date & Time") |
| `TimeSlotGrid` | Selectable time chips |
| `BottomSheet` | Radius 28 top corners, grab handle |
| `EmptyState` | Illustration + one line that says what to do + action button |
| `Illustration` | `name` + current mode → loads `assets/illustrations/<mode>/<name>.png`; until the file exists, renders a tinted rounded placeholder with a lucide icon. Names: `onboarding-1..3`, `queue-empty`, `customers-empty`, `stock-ok`, `compliance-ok`, `setup-done`, `promo-setup`, `sale-done`, `no-results` |
| `Toast` | Confirmations using the same verb as the button ("Sale saved") |
| `Skeleton` | Loading placeholders in `n20` |

## 4. Motion

Quiet. Press feedback (scale 0.98 + opacity), sheet slides, the theme cross-fade when the owner picks a mode
in setup (the one "wow" moment), and a check-mark animation after "Save sale". Respect Reduce Motion.

## 5. RTL

Use `start`/`end` (never `left`/`right`) in styles. Mirror chevrons and back arrows. Charts and numbers stay LTR.
Test every component in the gallery with RTL on.

## 6. Writing rules (UI copy)

- Plain words from the salon's point of view: "Close day", "New sale", "Check in", "Pay out tips".
- Buttons say exactly what happens; the toast repeats the verb ("Approve closing" → "Closing approved").
- Sentence case. No exclamation marks except on success screens. Errors say what happened and what to do
  ("Counted cash is AED 5.00 short. Add a reason to approve.").
- Empty states invite action ("No one is waiting. Add a walk-in.").
- Money always with currency: `AED 1,240.00`. Durations: `30 min`. Relative times: `in 25 min`, `waiting 6 min`.

## 7. Assets the owner will provide later

- App name, logo (square icon + wordmark), splash.
- Licensed illustration set in two moods (gents / ladies) — the reference kits' own illustrations
  belong to their creators and must not be copied.
- Optional photography for ladies promo banners.

Until then use placeholders; nothing in code should depend on final artwork sizes beyond the aspect ratios
in `Illustration`.
