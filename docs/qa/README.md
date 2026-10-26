# Live homepage checks (full update, Phase 7), 26 Oct 2026

Made by `node scripts/site/qa-live.cjs` against https://www.saloqo.com (deploy 48b5ffe). For each case there is one full-page picture (`home-<lang>-<width>-<city>.jpg`) and one picture after the footer currency switch was pressed (`…-switched-to-<cur>.jpg`). The raw readings are in `results.json`.

London blocks `/api/geo`, because the test Mac is in the UAE and the IP check would otherwise make it a UAE visitor.

| Case | Prices | App pictures | Headline | Pilot bar | Footer switch | Layout shift | Console errors |
|---|---|---|---|---|---|---|---|
| en 375 Dubai | AED | AED set | "…last dirham." | shown | → USD works | 0.0004 | analytics 404 only |
| en 1280 Dubai | AED | AED set | "…last dirham." | shown | → USD works | 0.0037 | analytics 404 only |
| ar 375 Dubai | AED | AED set | "…آخر درهم." | shown | → USD works | 0.0160 | analytics 404 only |
| ar 1280 Dubai | AED | AED set | "…آخر درهم." | shown | → USD works | 0.0007 | analytics 404 only |
| ur 375 Dubai | AED | AED set | "…آخری درہم…" | shown | → USD works | 0.0199 | analytics 404 only |
| ur 1280 Dubai | AED | AED set | "…آخری درہم…" | shown | → USD works | 0.0009 | analytics 404 only |
| en 375 London | USD | USD set | "…last cent." | none | → AED works | 0 | analytics 404 + the blocked geo call |
| en 1280 London | USD | USD set | "…last cent." | none | → AED works | 0.0037 | analytics 404 + the blocked geo call |
| ar 375 London | USD | USD set | "…آخر سنت." | none | → AED works | 0.0172 | analytics 404 + the blocked geo call |
| ar 1280 London | USD | USD set | "…آخر سنت." | none | → AED works | 0.0287 | analytics 404 + the blocked geo call |
| ur 375 London | USD | USD set | "…آخری سینٹ…" | none | → AED works | 0.0202 | analytics 404 + the blocked geo call |
| ur 1280 London | USD | USD set | "…آخری سینٹ…" | none | → AED works | 0.0001 | analytics 404 + the blocked geo call |

- **Right-to-left:** ar and ur pages are `dir="rtl"`, and no page scrolls sideways.
- **Layout shift:** the small shift on ar/ur comes from the Arabic font arriving after the first paint (see docs/DECISIONS.md, 2026-10-26). Google counts 0.1 or less as good.
- **Mobile LCP:** measured on the live site with Lighthouse's phone settings (slow 4G, CPU 4× slower), counting only loads where this Mac's connection didn't stall. en 1.4–1.6 s, ar 1.9–2.4 s, ur 1.8–2.4 s, all under 2.5 s.
- **Console errors:** the analytics 404 stops once Web Analytics is switched on in Vercel (Project → Analytics → Enable).
