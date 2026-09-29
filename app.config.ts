/**
 * Expo config: app.json holds the static settings; this adds what depends on the brand and the build
 * (store identifiers, the EAS project for push). The app name comes from src/config/brand.json.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

import brand from './src/config/brand.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: brand.appName,
  slug: config.slug ?? 'salon-control',
  ios: {
    ...config.ios,
    bundleIdentifier: brand.bundleId,
    infoPlist: { ...config.ios?.infoPlist, ITSAppUsesNonExemptEncryption: false },
  },
  android: { ...config.android, package: brand.bundleId },
  plugins: [...(config.plugins ?? []), ['expo-notifications', { color: '#FFFFFF' }]],
  extra: {
    ...config.extra,
    // Set by `eas init` (EAS_PROJECT_ID in the EAS environment); push on real phones needs it.
    eas: { projectId: process.env.EAS_PROJECT_ID ?? config.extra?.eas?.projectId },
  },
});
