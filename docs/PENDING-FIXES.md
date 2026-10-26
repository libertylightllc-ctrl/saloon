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

## Done

- 26 Oct · #2 Arabic pilot bar: six Arabic forms for "places left" (0, 1, 2, 3–10, 11–99, 100+), on the page and when the count refreshes. The language test now allows a language's own extra plural forms.
- 26 Oct · #3 Pilot form: every empty or wrong field shows what it needs under it (name and salon name at least 2 letters, staff 1 to 500, a WhatsApp number the database accepts, the WhatsApp tick); the message goes as soon as the field is right, and nothing is sent until all are. The WhatsApp tick is now required: the form has no email, so WhatsApp is the only way to reply.
