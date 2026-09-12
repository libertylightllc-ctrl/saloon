# Salon Control Mobile Builds

Salon Control uses Capacitor so the web app, Android app and iOS app share the
same HTML, CSS, JavaScript and Supabase backend.

## Update workflow

1. Make and test the feature in the web app.
2. Run `npm run mobile:sync` to rebuild `dist/` and copy it into both native apps.
3. Test Android and iOS.
4. Increase the store build number, then submit the signed build.

The cloud database, shop records and authentication are not bundled in the app,
so backend data changes do not require an app reinstall. App functionality and
user-interface code is shipped in versioned store builds.

The public website opens on the marketing page. Native builds open directly on
secure login, using a mobile-only build entry point.

## Local requirements

- Android: Android Studio, Android SDK and JDK 21.
- iOS: macOS, current Xcode and an Apple Developer account for device/App Store builds.
  The project uses Swift Package Manager, so CocoaPods is not required.

## Commands

```bash
npm ci
npm run test
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

`mobile:android` opens Android Studio. Build an APK for direct testing or an AAB
for Google Play. `mobile:ios` opens Xcode. Use a registered signing team to send
the build to TestFlight or the App Store.

## Automated artifacts

The **Build Mobile Apps** GitHub Actions workflow produces:

- an installable Android debug APK for testing;
- an unsigned iOS Simulator app to validate that the iOS project compiles.

A distributable iPhone IPA cannot be produced until Apple Developer signing is
configured in the repository or Xcode.

Never commit Android keystores, Apple certificates, provisioning profiles or
their passwords.
