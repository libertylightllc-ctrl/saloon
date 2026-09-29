/**
 * The only place the brand lives (values in brand.json, which app.config.ts also reads). "Salon Control" is a
 * working name until the owner picks the final one (START-HERE). `bundleId` is the iOS bundle identifier and
 * Android package: fixed forever once the app is in a store.
 */
import values from './brand.json';

export const brand = values as Readonly<typeof values>;
