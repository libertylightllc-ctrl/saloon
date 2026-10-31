# Pending fixes

Found by the owner, not yet fixed. When one is fixed, move it to "Done" with the date and commit.

## Found 26 Oct 2026

### Website
1. Add the "Why salons choose Saloqo" table (Saloqo | Many salon apps). It is still missing. (It was left out in Phase 1 of the full update; the owner now wants it. No competitor is named.)
2. Arabic pilot bar: use Arabic plural rules for "places left" (for example "يتبقى 20 مكانًا", not "20 أماكن").
3. Pilot form: show a visible message under each empty or invalid field (today it only moves to the first one). Either make the WhatsApp tick box required, or change the thank-you text when it is not ticked.

### Admin (console)
4. Empty states: Pilot → Applications ("No applications yet"), Pilot codes ("No codes yet"), Changes ("No changes yet").
5. Plans tab: a salon in its free period must say "Free until", not "Paid until".
6. Block a second plan request from the same salon while one is still waiting.
7. Plurals: "1 customer", "1 person signs in".
8. Date fields: a date picker instead of typing year-month-day.

### App
9. Home, "Expected cash today", shows −AED 396.92 with no sales and no opening cash (Demo Shop). Find the cause and fix it.

## Found 26 Oct 2026 while fixing #2

### App and website
10. Arabic counts everywhere else use one form for every number (for example "5 يومًا" where Arabic says "5 أيام", and "2 يومًا" for "يومان"). 27 counted texts need the Arabic forms for 0, 2, 3–10 and 11–99, as the pilot bar now has.

## Found 26 Oct 2026 while fixing #8

### App
11. Outside the console, two screens still have dates typed as year-month-day: a licence or document (issued, expires) and a stock item's date. The new calendar field (#8) can replace them once it has a quick way to jump a year: documents often expire 1–3 years ahead, and clicking month by month would be slower than typing.

## Found 27 Oct 2026 while testing

### Admin (console)
12. Salons tab is slow with many salons: it works out each salon's price, plan and counts one by one (about 3–4 ms a salon). With 667 test salons on the local database it takes 2–3 seconds, and on a busy machine more than 15 (a browser test timed out waiting for it on 27 Oct). Live has a handful of salons, so it is fine today; it needs paging or one combined query before the platform has hundreds.

## Round 2 (owner's brief SALOQO_FIXES_ROUND2.md, from a check of the live site on 28 Oct 2026)

### Part A — first
13. A1 Remove the Dubai claims: "Built in Dubai…" in the hero and "Made in Dubai" in the footer, in all 7 languages. Keep "For salons in Dubai, Sharjah…". A "Made in" line or company details only when set in config.
14. A2 FAQ "How long is it free?": the days from the settings (new salon, pilot) instead of "You'll see your free period in the app".
15. A3 One free period everywhere: 6 Plans records still say "7-day free trial" with the old end date while the Salons tab shows the 30-day date.

### Part B — homepage on phones (10,041 px tall at 390 px; target 6,500 px or less, pilot in the first 3 screens for UAE visitors)
16. B1 Pilot right after the hero for UAE visitors.
17. B2 Pricing cards as one swipe row on phones; "See everything included" toggle.
18. B3 Comparison table: 3 rows on phones and "Compare all".
19. B4 FAQ: 6 questions on phones and "More questions" (all stay in the HTML and JSON-LD).
20. B5 WhatsApp button and footer link while the number is set; the brief's pre-filled text.

### Part C — sign-up
21. C1 No "Confirm password" on sign-up.
22. C2 No email-confirmation wall before starting; a "Confirm your email" banner; confirmed email needed only to buy a plan (plan first, security).
23. C3 Salon type (4 types) in the first setup step, not on sign-up.
24. C4 Duplicate sign-ups: existing email goes to sign in; a WhatsApp number that already has a salon is asked about; the console flags likely duplicates.

### Part D — public booking page
25. D1 Per-salon link preview (title, description, a 1200×630 card with the logo).
26. D2 The salon's logo and address line on the page.

### Part E — console
27. E1 "Test salon" switch: test salons left out of the Overview numbers and labelled "Test".
28. E2 Changes tab with readable labels; empty states for Changes and Pilot → Applications.
29. E3 Duplicate plan requests merged in the console.
30. E4 "1 branch" / "2 branches" in Console → Salons, all 7 languages.

## Final brief (owner's SALOQO_FIXES_FINAL.md, from checks of the live site on 31 Oct 2026; replaces the earlier briefs)

Parts C, D and E are #21 to #30 above; the final brief adds D3 and changes E3 (below). B5 moved into A4.

### Part A — pilot and contact (first)
31. A1 Badges for new pilot applications (platform owners): "Pilot (1)", a dot on "Platform console" in More, the bell, "(1) Platform console" in the browser tab, and the Overview card's "1 new application – review" as a link to Pilot → Applications. They clear when each is approved or declined.
32. A2 Email to hello@saloqo.com for every new application: subject "New pilot application: <salon> (<emirate>)", every field, the date and a link to Pilot → Applications.
33. A3 The application card: "Salon: … · Owner: …", "<Emirate> · <Area>" (no repeat), "<Type> · <N> staff · Language: …", the WhatsApp number as a chat link with "OK to message on WhatsApp ✓", the date and time.
34. A4 WhatsApp number and message in Console → Settings → Contact (logged in Changes); every WhatsApp link in the app and the homepage's floating button and footer link use it, hidden while empty.

### Part D
35. D3 A changed booking link keeps the old address as a permanent redirect to the new one.

### Part E
36. E3 (changed) While a request waits, the Plan page says "Request sent, we'll be in touch" instead of the button; the console merges duplicates (Asil Trims has two).

## Done

- 26 Oct · #2 Arabic pilot bar: six Arabic forms for "places left" (0, 1, 2, 3–10, 11–99, 100+), on the page and when the count refreshes. The language test now allows a language's own extra plural forms.
- 26 Oct · #3 Pilot form: every empty or wrong field shows what it needs under it (name and salon name at least 2 letters, staff 1 to 500, a WhatsApp number the database accepts, the WhatsApp tick); the message goes as soon as the field is right, and nothing is sent until all are. The WhatsApp tick is now required: the form has no email, so WhatsApp is the only way to reply.
- 26 Oct · #1 "Why salons choose Saloqo": the brief's seven rows (Saloqo | Many salon apps) after the pricing, in 7 languages, for UAE visitors only.
- 26 Oct · #4 Console empty states: Pilot → Applications "No applications yet.", Pilot codes "No codes yet.", Changes "No changes yet." The texts existed but the shared list wrapper only showed them when a screen also passed an "is it empty" check; an empty list now shows its message by itself (these three were the only lists missing it).
- 26 Oct · #5 Console → Plans: a free period and access changes say "Free until", a pilot "Pilot · until"; only payments say "Paid until" (the database keeps every event's end date in one column).
- 26 Oct · #6 One plan request at a time: while a request waits, the plan page shows it and offers no second one, and the database refuses a second one ("You already asked for your plan…") — migration 68, live since 27 Oct (owner's OK).
- 26 Oct · #7 Console plurals: "1 customer", "1 person signs in", "1 new application", "1 owner", "1 staff login", a pilot code's "1 day", and plan requests "1 month" / "6 months" instead of "month(s)" (also on the owner's plan page). Lines that held several numbers are now one counted text per number.
- 26 Oct · #8 Console dates are picked on a month calendar (Monday first; the field shows "24 Jan 2027"): a salon's access date and a pilot code's "Valid until" (optional, can be cleared, no past days). The calendar is a shared field, `DateField`, built from the app's own parts so it works on the web and phones.
- 27 Oct · #9 Expected cash below zero. Cause, from Demo Shop's live books: the figure is the drawer's running total since its last close (30 Sep), and from 30 Sep to 4 Oct AED 1,246.92 was paid out "in cash" against AED 850.00 taken in (AED 500 electricity on 4 Oct with about AED 60 in the drawer; supplier bills and tips too). The app let a cash payment be bigger than the drawer, its opening cash was never set, and there was no way to record cash put in. Fixed: the database refuses any cash payment bigger than the drawer and says what it holds (migration 69, live since 28 Oct, owner's OK); Cash closing → "Add cash" records cash put in (from the owner or the bank), any day; Home says "What the drawer should hold now", or "More cash went out than came in. Count the drawer." when old records leave it below zero.
- 27 Oct · #10 Arabic counts: the 25 texts that put a noun after the number now have Arabic's forms for 2 (يومان), 3–10 (5 أيام), 11–99 (15 يومًا) and 100+ (100 يوم), as the pilot bar does. The other 12 counted texts already read "label: number" (العملاء: 5), which is right for every number, and stay as they are. New Arabic-only rows are in the translation review sheet.
- 27 Oct · #11 Licence and document dates (issued, expires) and a tool's next service date are picked on the calendar field too, which now has the years around the shown one a tap away (a licence 3 years ahead is one tap, not 36). The expiry calendar does not offer days before the issue date. Nothing in the app asks for a typed year-month-day any more.
- 28 Oct · #4 to #11 are live on saloqo.com, after 3 full test runs in a row (238 each) and the button sweep (8).
- 28 Oct · #12 Console Salons tab with many salons: the list's price and plan are now worked out for every salon in one pass instead of one salon at a time (migration 70, live since 30 Oct, owner's OK; 692 local salons: 1.1 s → about 50 ms, same rows, a database test checks it agrees with the one-salon price and plan for every kind of salon). The tab draws 50 salons at a time with "Show more" ("Showing 50 of 692"); search looks through all of them, and salons waiting on a plan request stay at the top. The activity lines (staff, customers, sales) come from a second call that was already about 0.1 ms a salon; when it fails (on a very busy machine it can pass the database's 8-second limit) the tab now says so with "Try again" instead of leaving the lines out.
- 30 Oct · #12 is live on saloqo.com. The owner asked for it to go out after 2 full test runs in a row (238 each); the third run and the button sweep were skipped. Four earlier attempts were spoiled by video exports overloading the Mac or filling its disk; every failure in them was traced to sign-in or server timeouts, none to the salons list. On the live database the new list gives the same price and "active" as before for all 12 salons.
- 30 Oct · #13 (A1) The site no longer says where Saloqo is made: the hero ends "…in one app, in 7 languages. For barber shops, salons and spas." and the footer is "© 2026 Saloqo", in all 7 languages, on the static homepage and the app's own landing page. "For salons in Dubai, Sharjah…" stays. A "Made in" line comes back only when `madeIn` is filled in `src/config/site.json` (empty until the company is registered). The Terms' governing-law line (UAE law as applied in Dubai) is left for the lawyer review. A test checks no page in any language says where Saloqo is made.
- 30 Oct · #14 (A2) FAQ "How long is it free?": "New salons get 30 days free. Pilot salons get 90 days free. Nothing is charged unless you choose a plan, and your data stays: you can view and export it any time." The days come from Console → Settings (read when the site is built); the pilot sentence shows only to UAE visitors and hides when the pilot is full. Day counts use each language's plural forms (Arabic's six).
- 30 Oct · #15 (A3) One free period everywhere: new salons already got "Free days for a new salon" (a test now checks the label and date, and that a changed setting gives the next salon the new length). The 6 old "7-day free trial" records on the live database now say "30-day free period" with the salon's real free date, the old values kept in Console → Changes, and the unused 7-day trial function is gone (migration 71, live since 30 Oct, owner's OK; on the live database: 0 old labels, 0 date mismatches, 6 change-log rows).
- 30 Oct · #13 to #15 are live on saloqo.com, deployed at once on the owner's word ("approve 71 and deploy now") without the full proof; their own page and database tests passed (e2e 56 and 58: 30/30, database tests: 1,020). Homepage at 390 px wide, as a UAE visitor: 9,881 px (was 10,041).
- 31 Oct · #16 (B1) The pilot section comes right after the hero for UAE visitors, on every screen size (at 1,013 px on a phone, was 6,575 px); the bar's "Apply" goes to it. Everyone else gets the page as before, with no pilot.
- 31 Oct · #17 (B2) On a phone the three plans are one sideways row with dots and the next card's edge showing; "Every feature on every plan" waits behind "See everything included" ("Show less" closes it); the calculator stays. Computers unchanged.
- 31 Oct · #18 (B3) On a phone the comparison shows "Each extra branch", "Booking commission" and "Daily cash closing", then "Compare all" for the other four rows. Computers unchanged.
- 31 Oct · #19 (B4) On a phone the FAQ shows the first 6 questions, then "More questions"; all 15 stay in the page and in the search engines' FAQ. Computers unchanged.
- 31 Oct · #20 (B5) The round WhatsApp button (bottom right; bottom left in Arabic and Urdu) and the footer's WhatsApp link show once a number is in src/config/site.json (still empty, so still hidden); UAE visitors' message is "Hi Saloqo, I'd like to know more about the pilot for my salon." The button texts are in all 7 languages.
- 31 Oct · Part B height: the home page at 390 px, UAE visitor, English, is 6,243 px (was 10,041 on the live check, 9,881 after Part A). Three sections that repeat other parts of the page are left out on phones only (see DECISIONS, 31 Oct). A test keeps the page at 6,500 px or less.
- 31 Oct · #16 to #19 (Part B) are live on saloqo.com, deployed at once on the owner's word ("deploy B now") without the full proof: its three tries were thrown out because other work on the Mac filled the disk and pushed the load to 65–226 (every failure was "no space left" or a sign-in timeout, none from the code). Live at 390 px wide, UAE visitor: English 6,243 px, Arabic 6,008, Hindi 6,131, Urdu 6,074, Spanish 6,651, French 6,703, Portuguese 6,639; the pilot starts at 1,013 px; 6 of 15 questions and 3 comparison rows until their buttons. #20 (B5) is live too but stays hidden until A4 gives it a number.
- 31 Oct · #33 (A3) The application card: "Salon: Demo pilot · Owner: Sorry", "Dubai · Al Barsha" (the area left out when it repeats the emirate), "Barber shop · 4 staff · Language: English" (the language in its own words), the WhatsApp number as a chat link with "OK to message on WhatsApp ✓", "Received 30 Oct 2026 · 14:05" (Dubai time). Commit 5ee8072.
- 31 Oct · #31 (A1) New pilot applications are counted, for platform owners only: "Pilot (1)" on the console tab, a red count on "Platform console" in More and in the sidebar, the bell (with a "1 new pilot application · Review" row in Notifications that opens Pilot), "(1) Platform console" in the browser tab, and the Overview card's "1 new application – review" button that opens Pilot → Applications. All of them go back to 0 when the applications are approved or declined (checked every 2 minutes and after each decision). Commit 4ea928a.
- 31 Oct · #32 (A2) The email for a new application: subject "New pilot application: Fade Lab (Ras Al Khaimah)", then salon, owner, emirate, area, type, staff, WhatsApp (with a chat link), OK to message, language, "Received: 31 Oct 2026, 14:05 (Dubai time)" and a link to Pilot → Applications. It goes to hello@saloqo.com and the platform owners through the email the app already has for plan requests and support (Resend). Nothing is sent until the owner adds RESEND_API_KEY in Supabase (Edge Functions → Secrets). Commit 49394de.
- 31 Oct · #34 (A4) Console → Settings has a "Contact" card: WhatsApp number (with the country code; "050…" is refused, spaces and 00 are fine) and the message (default "Hi Saloqo, I'd like to know more about the pilot for my salon."). Each change shows in Changes as settings:contact with the old and new value. Every WhatsApp link uses it: the app's buttons, and on the homepage (all 7 languages) the round button (bottom right; bottom left in Arabic and Urdu), the footer link, "Contact us", the top bar, the menu, the hero's "Ask on WhatsApp", the pilot's "Setup help on WhatsApp" point and "Book a demo". All are hidden while the number is empty; the homepage picks up a new number when it opens, without a new build. The number and messages are gone from src/config/site.json. Migration 72.
- 31 Oct · #31 to #34 (Part A) are live on saloqo.com (commit 145b9c3), on the owner's word ("approve 72 and deploy now") with the targeted tests rather than the full proof: website 54/54, console and pilot 8/8, unit tests, SQL test 56 (11/11), tsc and lint. Migration 72 is on the live database; the pilot email (plan-alert) is deployed as version 12. Live at 390 px, UAE visitor, all 7 languages: every page reads the WhatsApp setting when it opens; with the number still empty no WhatsApp button or link shows and "Contact us" opens /contact; heights unchanged (English 6,243 px). The email waits for RESEND_API_KEY ("skipped: no_key").
- 31 Oct · #21 (C1) Checked: sign-up has one password box with its show/hide eye and no "Confirm password" (that text is only on the reset-password screen, where it stays). The onboarding test now checks it.
- 31 Oct · #23 (C3) The salon type is now setup's first step ("Step 1 of 5"), with all four types, pre-selected with the type picked on the home page. With none picked, none is chosen for the owner (it used to fall back to Gents quietly): "Next" says "Choose your salon type to go on." In all 7 languages. Sign-up has no type choice (already so).
- 31 Oct · #22 (C2) No confirmation wall: once "Confirm email" is off in Supabase, a new owner is signed straight in and sent a "Confirm your email for Saloqo" link. Home shows "Confirm your email: we sent a link to … [Resend]" to owners (× hides it until the next day; staff never see it). Asking for a plan and paying by card need a confirmed address: the Plan page says so and its buttons are off, and the database refuses them. Opening the link, signing in with Google or resetting the password with the emailed code confirms the address; everyone confirmed today stays confirmed. If Google joins an account whose address was never confirmed, its password is removed and every device is signed out. In all 7 languages. Migration 74 (not yet on the live database). Owner to-do after the deploy: turn off "Confirm email" and change the Magic Link email (text in supabase/templates/magic_link.html).
- 31 Oct · #24 (C4) Sign-up with an email that already has an account shows "This email already has an account" with Sign in and "Forgot password?" (also once "Confirm email" is off, when Supabase answers with an error instead). A mobile / WhatsApp number that the owner of an open salon already gave gets "This number already has a salon on Saloqo. Sign in instead?" with Sign in and "Continue anyway". Console → Salons marks "Possible duplicate" with "Same owner name as …" / "Same number as …". In all 7 languages. Migration 73 (not yet on the live database).
- 31 Oct · #26 (D2) Checked: the booking page already shows the salon's logo (a scissors mark without one) and its address under the name, on the live site too (Asil Trims shows its logo and "Doha Qatar"). A test now checks both, and that the logo loads.
- 31 Oct · #35 (D3) A changed booking link keeps the old one: it opens the salon's current page (the website answers with a permanent redirect; in the app the page moves on), no other salon can take it, and switching the page off closes both. The link settings say "Your old link keeps working: it sends people to the new one." In all 7 languages. Migration 75 (not yet on the live database).
- 31 Oct · #25 (D1) A booking link now previews as the salon in WhatsApp, Instagram, iMessage and the rest: "Book at <Salon> – <town>", "<N> services · book online, no app needed" (1 service, and Arabic's own forms), and the salon's logo on a 1200 × 630 Saloqo card (else its cover photo, else Saloqo's card). Before, only some preview bots got the salon's name, with Saloqo's picture. Checked against the local database: a salon's link, an old link (301 to the new one), an unknown link, the card with and without a logo.
- 31 Oct · #30 (E4) Console → Salons counts branches in words: "Code … · 1 branch · joined …", "2 branches", in all 7 languages with Arabic's own forms (فرع واحد، فرعان، 3 فروع، 11 فرعًا).
- 31 Oct · #36 (E3) While a plan request waits, the Plan page shows "Request sent, we’ll be in touch" and what was asked and when, also with billing off (it showed nothing then). Console → Plans shows Asil Trims' two identical requests of 20 Oct (26 seconds apart, before one-request-at-a-time went live) as one row: "Sent 2 times, first on 20 Oct 2026 · 21:33". In all 7 languages. No database change.
- 31 Oct · #28 (E2) Console → Changes reads in sentences in all 7 languages: "Pilot places: 20 → 15", "Billing: on → off", "Free days for a new salon: 30 → 14", "Nebriix: free period changed from 1 Nov to 24 Nov 2026 (30-day free period)", a salon's access and notes, pilot codes and applications, with who and when underneath ("Automatic update" for the database's own corrections). "No changes yet" and "No applications yet" (done 26 Oct, #4) now have tests. No database change.
