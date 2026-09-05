# Google Play submission guide — Mine Pool

## App identity

- App name: Mine Pool
- Package: `com.minepool.game`
- Category: Game → Sports
- Current version: `1.0.0` (`versionCode 1`)

Short description (80 characters maximum):

> Play realistic 8-ball pool online, in tournaments, or against AI.

Suggested full description:

> MINE POOL brings competitive 8-ball pool to mobile with precise controls, polished visuals and realistic ball physics.
>
> REAL-TIME MULTIPLAYER
> • Match with online players
> • Skill-based rating and matchmaking
> • Secure account-based progress
>
> TOURNAMENTS AND SOLO PLAY
> • Compete through tournament brackets
> • Practice against adjustable AI opponents
> • Play locally as a guest
>
> BUILD YOUR POOL CAREER
> • Earn virtual coins through play
> • Unlock and select detailed cues
> • Track match history, wins and rating
>
> Virtual coins are gameplay items only and have no monetary value. Mine Pool does not use cryptocurrency or wallets.

Do not advertise cash prizes, “play to earn,” crypto, token trading, or monetary value. The current app does not include Google Play Billing, so declare it as free without in-app purchases unless billing is deliberately added later.

## Public policy URLs

- Privacy policy: `https://api.taingames.com/privacy.html`
- Account deletion: `https://api.taingames.com/delete-account.html`
- Support email: `support@minepool.com` — verify that this inbox is active before submission.

These pages are included in `www` and become public after the server is redeployed. The deletion page accepts off-device requests; the in-app Player Account screen supports authenticated immediate deletion.

## Store assets

- Launcher icons: `android/app/src/main/res/mipmap-*`
- Feature graphic: 1024 × 500
- Phone screenshots: at least 2, preferably 4–8 current gameplay images
- Recommended captures: home screen, aiming shot, matchmaking, tournament bracket, win screen, cue selection

Do not submit old screenshots containing wallet, token, Play & Earn, or outdated UI elements.

## Signed Android App Bundle

Create and securely back up a Play upload key once:

```powershell
keytool -genkeypair -v -keystore C:\secure\minepool-upload.jks -alias minepool -keyalg RSA -keysize 2048 -validity 10000
```

Set the four signing values documented in `MOBILE_RELEASE.md`, then build:

```powershell
cd android
.\gradlew.bat bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Verify the bundle is signed before upload:

```powershell
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
```

Keep the upload keystore and passwords outside Git. Enable Play App Signing in Play Console.

## Play Console checklist

- [ ] Increment `versionCode` for every uploaded release.
- [ ] Configure the real Google Web OAuth client ID; confirm Google sign-in on a Play-installed build.
- [ ] Upload a signed AAB targeting the currently required Android API level.
- [ ] Complete Store listing and upload current assets.
- [ ] Complete Data safety using `PLAY_DATA_SAFETY.md` as a draft, verified against production.
- [ ] Complete Target audience, Content rating, Ads, App access and privacy declarations.
- [ ] Publish and test both policy URLs.
- [ ] Test email registration/login, Google sign-in, sign-out and both deletion paths.
- [ ] Test AI, tournament and multiplayer matches on physical devices and different networks.
- [ ] Test reconnect, app background/resume, audio interruption, offline behavior and rotation lock.
- [ ] Run the required closed test if the developer account is subject to Google’s personal-account testing rule.

## Release gate

Do not send the production release until all checklist items pass. A locally generated unsigned AAB is suitable only for build verification, not Play Console upload.
