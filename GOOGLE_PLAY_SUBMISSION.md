# Google Play Store Submission Guide - Mine Pool

## App Information

### Basic Details
- **App Name:** Mine Pool
- **Package Name:** com.minepool.game
- **Version:** 1.0.0
- **Version Code:** 1

### Short Description (80 chars max)
```
Play 8-Ball Pool online, win matches, earn TAIN tokens. Join global players!
```

### Full Description (4000 chars max)
```
🎱 MINE POOL - The Ultimate 8-Ball Pool Experience!

Play real-time 8-ball pool matches against players worldwide. Win matches, earn rewards, and climb the global leaderboard!

🌟 KEY FEATURES:

⚡ REAL-TIME MULTIPLAYER
• Play against real players from around the world
• Fair matchmaking based on skill level
• Smooth, lag-free gameplay

🎯 REALISTIC PHYSICS
• True-to-life ball physics
• Precision aiming system
• Strategic spin control

💰 PLAY & EARN
• Win matches to earn TAIN tokens
• Stake your coins for higher rewards
• Daily rewards and tasks

🏆 COMPETE & CLIMB
• Global leaderboards
• ELO ranking system
• Tournaments with big prizes

🎨 CUSTOMIZE
• Unlock premium cues
• Choose your avatar
• Show your nationality flag

📱 FEATURES:
• Works offline with AI opponents
• Multiple difficulty levels
• Cross-platform play
• Secure wallet integration

Download now and become the ultimate pool champion!

Connect with us:
• Twitter: @TAINGames
• Telegram: t.me/TAINGames
• Website: taingames.com
```

### Category
**Game** → **Sports**

### Content Rating
**Everyone** (No violence, gambling for real money is virtual tokens)

### Tags/Keywords
```
pool, 8ball, billiards, multiplayer, online game, sports, cue sports, crypto game, play to earn, snooker
```

---

## Required Assets

### App Icon
- ✅ Already created at: `android/app/src/main/res/mipmap-*/ic_launcher.png`
- Sizes: 48x48 to 512x512

### Feature Graphic (1024x500)
- Required for Play Store listing
- Should show game branding

### Screenshots (Required)
You need at least 2 screenshots for each:
- **Phone:** 1080x1920 or 1920x1080 (min 2, max 8)
- **Tablet (7"):** 1200x1920 (optional but recommended)
- **Tablet (10"):** 1600x2560 (optional)

Recommended screenshots:
1. Main menu with profile
2. Gameplay - aiming shot
3. Matchmaking screen
4. Winning screen
5. Shop/Cues screen
6. Leaderboard

### Promo Video (Optional)
- YouTube link
- 30 seconds to 2 minutes
- Shows gameplay

---

## Required Policies

### Privacy Policy URL
You MUST have a privacy policy. Create one at:
- Option 1: Use a generator like https://app-privacy-policy-generator.nisrulz.com/
- Option 2: Host on your website: https://taingames.com/privacy-policy

Example privacy policy areas to cover:
- Data collected (wallet address, username, game stats)
- How data is used
- Third-party services (WalletConnect)
- Data retention
- Contact information

### Terms of Service URL (Recommended)
- https://taingames.com/terms-of-service

---

## Build Signed APK/AAB

### Step 1: Create Keystore (One-time)
```bash
keytool -genkey -v -keystore minepool-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias minepool
```

### Step 2: Configure Signing in build.gradle
Add to `android/app/build.gradle`:
```gradle
android {
    signingConfigs {
        release {
            storeFile file('minepool-release-key.jks')
            storePassword 'YOUR_STORE_PASSWORD'
            keyAlias 'minepool'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Step 3: Build Release Bundle
```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Google Play Console Setup

### Developer Account
1. Go to https://play.google.com/console
2. Pay $25 one-time registration fee
3. Verify identity

### Create New App
1. Click "Create app"
2. Select "Game"
3. Enter app name: "Mine Pool"
4. Select language: English

### Fill Required Sections
1. **Store listing** - descriptions, screenshots
2. **Content rating** - complete questionnaire
3. **Pricing & distribution** - Free (with in-app purchases)
4. **App content** - privacy policy, ads declaration
5. **App release** - upload AAB file

---

## Before Submission Checklist

- [ ] Privacy Policy URL is live
- [ ] Terms of Service URL is live
- [ ] Feature graphic (1024x500) created
- [ ] At least 4 screenshots ready
- [ ] App icon looks good at small sizes
- [ ] Test on multiple devices
- [ ] Test wallet connection on mobile
- [ ] Test game against AI
- [ ] Test multiplayer match
- [ ] Server is stable (Railway)
- [ ] All links work (Zealy, Twitter, Telegram)

---

## Post-Submission

- Review typically takes 1-7 days
- You may receive feedback requiring changes
- First app submission often requires more review time
- Watch for emails from Google Play

Good luck! 🎱🚀
