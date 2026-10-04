# Court on Android — release checklist

The Android app is the same web build wrapped with Capacitor (`android/`).
Every push runs `.github/workflows/android.yml`, which builds a **debug APK**
you can install directly. Once signing secrets exist it also builds a
**signed release bundle (.aab)** for Google Play.

## Try it on your phone now

1. Open the latest **Android build** run under the repo's Actions tab.
2. Download the `court-debug-apk` artifact and unzip it.
3. Copy `app-debug.apk` to the phone and open it. Android will ask you to
   allow installs from that source.

A debug build is for testing only; Play will not accept it.

## Before the first Play upload (owner: you)

### 1. Choose the application ID, permanently

The build uses the placeholder `com.example.court`, which Play rejects.
Once an app is uploaded, its ID can never change. Use a reverse domain
you control, e.g. `io.github.loganbsattler.court`. Change it in:

- `capacitor.config.ts` → `appId`
- `android/app/build.gradle` → `namespace` and `applicationId`
- `android/app/src/main/java/com/example/court/MainActivity.java` → move it to
  the matching package folder and update its `package` line

Or tell Claude the ID, and it will make the change.

### 2. Settle the title

"Court" is a working title. Search the Play Store, and check trademarks,
before listing.

### 3. Create the upload key (once, on your computer)

```
keytool -genkeypair -v -keystore court-upload.keystore -alias court \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep the keystore file and both passwords somewhere safe, such as a password
manager. Never commit the keystore. With Play App Signing (the default for new
apps), this is only the *upload* key, and Google can reset it if it is lost.

### 4. Add four GitHub secrets

In the repo, go to Settings → Secrets and variables → Actions → New repository
secret, and add:

| Secret | Value |
|---|---|
| `COURT_KEYSTORE_BASE64` | output of `base64 -w0 court-upload.keystore` (macOS: `base64 -i court-upload.keystore`) |
| `COURT_KEYSTORE_PASSWORD` | the keystore password |
| `COURT_KEY_ALIAS` | `court` (or the alias you chose) |
| `COURT_KEY_PASSWORD` | the key password |

The next push then produces a `court-release-aab` artifact.

### 5. Play Console

- Create a developer account (one-time fee). New personal accounts must run a
  **closed test** before they can publish to production. Check Google's current
  rule in the Play Console Help ("app testing requirements") for the number of
  testers and days; it decides your earliest launch date.
- Create the app, then upload the `.aab` to the closed-testing track.
- **Privacy policy URL:** https://logan-bsattler.github.io/Court/privacy.html
- **Data safety form:** no data collected or shared.
- **Content rating questionnaire:** a card game with no gambling, chat or
  user content.
- **Store listing:** short and full description, an icon (512×512), a feature
  graphic (1024×500), and at least two phone screenshots.

### 6. Monetization (open decision)

Paid, or free with a one-time unlock. A one-time unlock needs Google Play
Billing, which is extra work; a paid app needs none.

## Version numbers

`versionCode` is the Actions run number, so every CI build is higher than the
last, as Play requires. `versionName` is `0.1.<run number>`.
