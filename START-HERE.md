# Start here (for you, not for Claude Code)

## How to use this pack

1. Make an empty folder for the project, e.g. `salon-app`.
2. Put everything from this pack inside it, keeping the structure:
   ```
   salon-app/
     CLAUDE.md
     START-HERE.md
     docs/ 01-PRODUCT.md … 05-BUILD-PLAN.md, DECISIONS.md, reference/
   ```
3. Open Claude Code in that folder. It reads `CLAUDE.md` by itself.
   (Setup help: https://docs.claude.com/en/docs/claude-code/overview)
4. Open `docs/05-BUILD-PLAN.md`, copy the **Phase 0** prompt, paste it into Claude Code.
5. When it finishes, do the "You check" list for that phase on your phone. Then paste the next phase.
6. Don't skip Phase 1 sign-off. If the look isn't right there, it won't be right anywhere.

Tips
- One phase per session keeps Claude Code focused. Start a fresh session for each phase.
- If you change your mind about a feature, edit `docs/01-PRODUCT.md` first, then tell Claude Code
  "I updated 01-PRODUCT §3.4, please apply it."
- Screenshots of what looks wrong are the fastest feedback.

## Your side (the physical / money / paperwork jobs)

**Now (before Phase 2)**
- [ ] Supabase account (free to start; you'll move to a paid plan before real salons use it — check their current pricing)
- [ ] Expo account (free) — used to build the app for phones
- [ ] A test iPhone and a test Android phone (and a tablet if the counter will use one)
- [ ] Real data from one gents shop and one ladies salon: service menu with prices and durations, staff list with
      salary and commission %, suppliers, stock items, the compliance documents list with expiry dates

**Before Phase 13 (store release)**
- [ ] App name — check the name is free on the App Store, Google Play and as a domain
- [ ] Logo (square icon + wordmark)
- [ ] Licensed illustration set in two moods (barber / ladies salon). Don't use the ones from the reference images —
      they belong to their designers. Buy a pack or hire an illustrator.
- [ ] Apple Developer account (currently USD 99 / year). For a company account Apple asks for a D-U-N-S number — apply early, it can take a while.
- [ ] Google Play Console account (currently USD 25 one-time)
- [ ] Domain + support email + privacy policy and terms pages (both stores require a privacy policy URL;
      UAE has a personal data protection law — get it checked)
- [ ] Trade licence and company bank account in place (needed for store company accounts and payments)

**Only if you do the customer booking app (Phase 14)**
- [ ] Payment gateway merchant account (options in UAE include Stripe, Network International, Telr, Tap — compare fees)
- [ ] SMS provider for phone-number login codes
- [ ] Later: WhatsApp Business API (Meta business verification) if you want automatic WhatsApp receipts

## What's decided (change any of it — just update the docs)

See `docs/DECISIONS.md`. Short version: one app, two looks (gents violet / ladies pink) chosen per branch;
features from your Salon Control reference; UAE first; Expo + Supabase; customer booking app is optional and last.
