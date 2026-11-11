# IslandHop — Build a signed .aab for Google Play

This project supports a signed Google Play **.aab**, but the signing key itself
must stay out of the repository.

## Option A — Android Studio (recommended)

1. Open `frontend/android` in **Android Studio** (File > Open, then navigate to `frontend/android`).
2. Let Gradle sync finish.
3. Copy `keystore.properties.example` to `keystore.properties` (same folder).
4. Put your upload keystore at `frontend/android/keystore/islandhop-upload.jks`.
5. **Build > Build Bundle(s) / APK(s) > Build Bundle(s)**.
6. The signed bundle is created at:
   `frontend/android/app/build/outputs/bundle/release/app-release.aab`
7. Upload that `.aab` to the Google Play Console.

## Option B — command line (with Android SDK + JDK 21 installed)

From the **repository root**:

```bash
cd frontend/android
./gradlew bundleRelease
# output: app/build/outputs/bundle/release/app-release.aab
```

Or use the convenience script from `frontend/` which also builds the web app and
runs `cap sync`:

```bash
cd frontend
./build-aab.sh
```

## Local signing files

- Keystore file: `frontend/android/keystore/islandhop-upload.jks`
- Config file: `frontend/android/keystore.properties` (**git-ignored — never commit**)
- Template: `frontend/android/keystore.properties.example`

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

The workflow recreates `frontend/android/keystore/islandhop-upload.jks` and
`frontend/android/keystore.properties` at runtime before `bundleRelease` runs.

Package name (applicationId): **com.islandhop.app**
The current release is `versionCode 3` / `versionName 1.2`; bump these in
`frontend/android/app/build.gradle` for each release.
