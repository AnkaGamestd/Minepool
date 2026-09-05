# Mine Pool account setup

The app supports email/password accounts immediately. Google sign-in uses Android Credential Manager and validates every Google ID token on the Node server.

## Google Cloud / Play Console

1. In Google Auth Platform, configure the OAuth consent screen and create a **Web application** OAuth client.
2. Create an **Android** OAuth client for package `com.minepool.game`. Add the SHA-1 fingerprints for the local debug key and the Google Play App Signing certificate.
3. Use the Web client ID—not the Android client ID—for both settings below.

## Server

Set these Railway variables and redeploy:

```text
GOOGLE_WEB_CLIENT_ID=000000000000-example.apps.googleusercontent.com
JWT_SECRET=<a long random production secret>
```

## Android build

Put this line in the user-level or project `gradle.properties` file used by the release build. Do not commit secrets or generated credential files.

```text
MINEPOOL_GOOGLE_WEB_CLIENT_ID=000000000000-example.apps.googleusercontent.com
```

Then synchronize and build:

```text
npm run mobile:copy
cd android
gradlew bundleRelease
```

Returning users who previously authorized Mine Pool are offered automatic account selection when the app starts. If more than one eligible Google account exists, Android shows the secure account chooser. A manual **Continue with Google** button remains available in Profile → Account.
