# IslandHop — Build a signed .aab for Google Play

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
cd android
./gradlew bundleRelease
# output: app/build/outputs/bundle/release/app-release.aab
```

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
