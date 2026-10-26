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

## Done

- 26 Oct · #2 Arabic pilot bar: six Arabic forms for "places left" (0, 1, 2, 3–10, 11–99, 100+), on the page and when the count refreshes. The language test now allows a language's own extra plural forms.
- 26 Oct · #3 Pilot form: every empty or wrong field shows what it needs under it (name and salon name at least 2 letters, staff 1 to 500, a WhatsApp number the database accepts, the WhatsApp tick); the message goes as soon as the field is right, and nothing is sent until all are. The WhatsApp tick is now required: the form has no email, so WhatsApp is the only way to reply.
- 26 Oct · #1 "Why salons choose Saloqo": the brief's seven rows (Saloqo | Many salon apps) after the pricing, in 7 languages, for UAE visitors only.
- 26 Oct · #4 Console empty states: Pilot → Applications "No applications yet.", Pilot codes "No codes yet.", Changes "No changes yet." The texts existed but the shared list wrapper only showed them when a screen also passed an "is it empty" check; an empty list now shows its message by itself (these three were the only lists missing it).
- 26 Oct · #5 Console → Plans: a free period and access changes say "Free until", a pilot "Pilot · until"; only payments say "Paid until" (the database keeps every event's end date in one column).
- 26 Oct · #6 One plan request at a time: while a request waits, the plan page shows it and offers no second one, and the database refuses a second one ("You already asked for your plan…") — migration 68, which goes to the live database only after the owner's OK.
- 26 Oct · #7 Console plurals: "1 customer", "1 person signs in", "1 new application", "1 owner", "1 staff login", a pilot code's "1 day", and plan requests "1 month" / "6 months" instead of "month(s)" (also on the owner's plan page). Lines that held several numbers are now one counted text per number.
- 26 Oct · #8 Console dates are picked on a month calendar (Monday first; the field shows "24 Jan 2027"): a salon's access date and a pilot code's "Valid until" (optional, can be cleared, no past days). The calendar is a shared field, `DateField`, built from the app's own parts so it works on the web and phones.
