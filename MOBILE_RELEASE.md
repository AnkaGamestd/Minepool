# Mine Pool mobile release

The Android and iOS projects package the files in `www`. The game does not open a remote website inside the app. Multiplayer connects securely to `https://api.taingames.com`.

## Prepare native projects

```bash
npm ci
npm run mobile:sync
npm run mobile:doctor
```

Run `npm run mobile:sync` after every change under `www` or to a Capacitor plugin.

## Android

Requirements: Android Studio, JDK 17, and an Android SDK matching the compile SDK in `android/variables.gradle`.

```bash
npm run mobile:android
```

In Android Studio, test on a landscape phone and tablet. For Google Play, increment `versionCode` and `versionName` in `android/app/build.gradle`, configure a private upload keystore, and generate a signed Android App Bundle (`.aab`). Never commit the keystore or its passwords.

Release signing is read from Gradle properties or environment variables, so secrets never need to be stored in the repository:

```text
MINEPOOL_KEYSTORE_FILE=C:/secure/minepool-upload.jks
MINEPOOL_KEYSTORE_PASSWORD=...
MINEPOOL_KEY_ALIAS=minepool
MINEPOOL_KEY_PASSWORD=...
```

Set these as environment variables in CI, or add them to your private user-level `~/.gradle/gradle.properties`. If any value is missing, Gradle deliberately creates an unsigned verification bundle and prints a warning.

Command-line verification outputs are written to `android/app/build/outputs/apk/debug/app-debug.apk` and `android/app/build/outputs/bundle/release/app-release.aab`. The release bundle remains unsigned until the private upload keystore is configured.

## iOS

Requirements: macOS, Xcode, an Apple Developer account, and CocoaPods.

```bash
npm run mobile:ios
```

In Xcode, select the App target, choose the development team, verify the bundle identifier `com.minepool.game`, and increment the build and marketing versions. Archive a landscape iPhone/iPad build and upload it through Organizer.

## Release checklist

- Confirm `https://api.taingames.com/api/health` is healthy.
- Confirm `https://api.taingames.com/privacy.html` and `https://api.taingames.com/delete-account.html` are public and submit the same URLs in Play Console.
- Verify email registration, Google sign-in, sign-out, in-app deletion, and the web deletion-request form.
- Test matchmaking between two physical devices on different networks.
- Test background/resume, airplane mode, reconnection, audio interruption, and screen rotation lock.
- Verify safe areas on notched devices and tablets.
- Review the Google Play artwork in `store-assets/google-play`, replace development screenshots when needed, and confirm the privacy policy/support URLs.
- Keep `android:usesCleartextTraffic` disabled and do not add arbitrary-load exceptions to iOS.
- Build from a clean checkout with `npm ci` before store submission.

The application identifier is intentionally unchanged. Changing it creates a different app in Google Play and App Store Connect.
