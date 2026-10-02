/**
 * The only place the brand lives (values in brand.json, which app.config.ts also reads). The owner chose "Saloqo"
 * (saloqo.com) on 2026-10-03. `bundleId` is the iOS bundle identifier and Android package: fixed forever once the
 * app is in a store.
 */
import values from './brand.json';

export const brand = values as Readonly<typeof values>;
