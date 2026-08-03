# IslandHop — Build a signed .aab for Google Play

<<<<<<< HEAD
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
=======
This project supports a signed Google Play **.aab**, but the signing key itself
must stay out of the repository.

## Option A — Android Studio (recommended)

1. Open the `android` folder in **Android Studio** (File > Open).
2. Let Gradle sync finish.
3. Copy `keystore.properties.example` to `keystore.properties`.
4. Put your upload keystore at `android/keystore/islandhop-upload.jks`.
5. **Build > Build Bundle(s) / APK(s) > Build Bundle(s)**.
6. The signed bundle is created at:
   `android/app/build/outputs/bundle/release/app-release.aab`
7. Upload that `.aab` to the Google Play Console.

## Option B — command line (with Android SDK + JDK 21 installed)

```bash
>>>>>>> cb805eb
cd android
./gradlew bundleRelease
# output: app/build/outputs/bundle/release/app-release.aab
```

<<<<<<< HEAD
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
=======
## Local signing files

- Keystore file: `android/keystore/islandhop-upload.jks`
- Config file: `android/keystore.properties`
- Template: `android/keystore.properties.example`

If these credentials were ever committed or shared publicly, rotate them and use
Google Play's upload key reset process if needed.

## GitHub Actions secrets

The workflow expects these repository or environment secrets:

- `ANDROID_KEYSTORE_BASE64`: base64-encoded contents of `islandhop-upload.jks`
- `ANDROID_KEYSTORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: key alias
- `ANDROID_KEY_PASSWORD`: key password

On macOS you can copy the base64 value with:

```bash
base64 -i islandhop-upload.jks | pbcopy
```

The workflow recreates `android/keystore/islandhop-upload.jks` and
`android/keystore.properties` at runtime before `bundleRelease` runs.

Package name (applicationId): **com.islandhop.app**
The current release is `versionCode 3` / `versionName 1.2`; bump these in
`android/app/build.gradle` for each release.
>>>>>>> cb805eb
