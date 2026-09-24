# Salon Control (working name)

Phone and tablet app that runs a salon day to day, in two looks: **gents** (violet) and
**ladies** (coral-pink). Expo + React Native + TypeScript, Supabase backend.

- What to build and why: `CLAUDE.md` and `docs/01…05`
- Decisions made along the way: `docs/DECISIONS.md`
- How the owner uses this pack: `START-HERE.md`

## Run it on your phone

1. Install **Expo Go** from the App Store / Google Play (it must support SDK 57).
2. On the computer, in this folder:
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code: iPhone with the Camera app, Android from inside Expo Go.
   Phone and computer must be on the same Wi-Fi. If they can't see each other, run
   `npx expo start --tunnel`.

## Develop

```bash
npm run check      # typecheck + lint + format check + tests
npm test           # unit tests only
npm run web        # browser preview (developer use only)
```

Backend (from phase 2): copy `.env.example` to `.env`, start Docker, then
`npx supabase start` and put the printed API URL and anon key in `.env`.
