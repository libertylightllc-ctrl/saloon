# More salon types — plan (website brief 5.4, 23 Oct 2026)

Today there are two types, `gents` ("Gents salon", violet) and `ladies` ("Ladies salon & spa", coral). The type sits
on each branch (`branches.mode`, enum `salon_mode`) and decides the look, the words (Barber/Stylist, Chair/Station),
the starter services at setup, and whether bookings need a room. The brief asks for **Unisex salon** and **Beauty &
wellness studio** (nails, lashes and brows, skincare and facials, massage). Nothing below is built until you approve it.

## What each new type gets (to confirm)

| | Unisex salon | Beauty & wellness studio |
|---|---|---|
| Look | Gents layout (header band), Saloqo teal colours | Ladies layout (soft sheet), a calm sage or lavender |
| Staff word | Stylist (any stylist) | Therapist (any therapist) |
| Place word | Chair | Room |
| Starter categories | Hair, Colour, Beard, Nails, Treatments | Nails, Lashes & brows, Skincare & facials, Massage, Waxing |
| Starter services | Men's cut, Women's cut, Blow-dry, Colour, Beard trim, Manicure | Manicure, Pedicure, Gel nails, Lash lift, Brow shaping, Classic facial, Swedish massage, Deep-tissue massage, Waxing |
| Rooms | No | Yes: 2 treatment rooms; massage and facials need one |
| Patch-test reminders | Yes (colour) | Yes (lash and brow tint) |

Prices start from today's starter prices (AED, converted for other countries as now). The colours need your eye: I
would show you both looks on the home screen, the queue and a receipt before going further.

## How (one change in each place, no new concepts)

1. **Database** (one migration): add `unisex` and `wellness` to `salon_mode`; a starter catalogue for each in
   `seed_mode_catalogue` (today any value that is not `gents` silently gets the ladies list); replace the four
   `mode = 'ladies'` room checks (`create_appointment`, `public_booking_slots`, `public_book`, the room seed) with one
   rule, "this type uses rooms" (ladies and wellness). Switching a branch's type keeps its services and rooms, as now.
2. **Look and words**: two theme files built from the existing kits (each part of a theme is today one of the two
   kit styles, so a new type mixes them: no new component styles); 5 words × 2 types in all 7 languages; a fallback
   so an unknown type shows the default look instead of failing.
3. **Choosing the type**: the four places that list the two types (setup, Branch settings, the sign-up panel, the
   home page and the website's "Which salon are you?") show four, two by two on a phone; the device's remembered type
   accepts the new values.
4. **Screens that check for `ladies`**: new appointment (room picker) and the service form (needs a room, patch test)
   follow the "uses rooms" / "patch tests" rule instead.
5. **Help and console**: the support assistant's knowledge and the console's salon list name the four types.
6. **Pictures**: a queue screenshot of each new look for the type cards (taken from the real app, as now).

About 15 app files, 1 migration, 7 language files, the website generator (2 files), and the tests that pick a type.

## Gaps found on the way (worth fixing whatever you decide)

- There is no screen to add or rename rooms: rooms exist only from the ladies starter set. A wellness studio needs one.
- A branch switched from Gents to Ladies keeps no rooms, so bookings of room services are refused; switching type
  should offer the new starter rooms.

## Testing

Unit and database tests for each type's catalogue, rooms rule and words; the browser tests run today for both types
(gents and ladies) — rather than doubling the whole run, the new types get a smaller set: setup, a walk-in, a booking
with a room, a sale and the receipt.

## Questions for you

1. Colours: Saloqo teal for Unisex, and sage or lavender for Beauty & wellness?
2. The words: "Stylist"/"Chair" for Unisex, "Therapist"/"Room" for Beauty & wellness?
3. The starter services and prices above — anything to add or drop?
4. Add the rooms screen at the same time?
