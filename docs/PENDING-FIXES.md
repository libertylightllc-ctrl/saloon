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
