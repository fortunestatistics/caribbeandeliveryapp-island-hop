# IslandHop — Build a signed .aab for Google Play

This project is pre-configured with a release signing key, so you can produce a
Play-ready **.aab** in one click.

## Option A — Android Studio (recommended)
1. Open the `android` folder in **Android Studio** (File > Open).
2. Let Gradle sync finish.
3. **Build > Build Bundle(s) / APK(s) > Build Bundle(s)**.
4. The signed bundle is created at:
   `android/app/build/outputs/bundle/release/app-release.aab`
5. Upload that `.aab` to the Google Play Console.

## Option B — command line (with Android SDK + JDK 17 installed)
```
cd android
./gradlew bundleRelease
# output: app/build/outputs/bundle/release/app-release.aab
```

## Signing key (KEEP THIS SAFE — needed for every future update)
- Keystore file: `android/keystore/islandhop-upload.jks`
- Store password: `islandhop2026`
- Key alias:      `islandhop`
- Key password:   `islandhop2026`

> Recommended: change these passwords and regenerate the key for production, and
> enroll in **Google Play App Signing** (upload key model). If you lose this
> keystore you won't be able to push updates under the same upload key.

Package name (applicationId): **com.islandhop.app**
versionCode 1 / versionName 1.0 — bump these in `android/app/build.gradle` for each release.
