# Build the IslandHop Google Play bundle

The Android project is in this directory. Open `frontend/android` in Android
Studio, not the repository root.

## Before building

The application ID must remain `com.islandhop.app`. Each Play release must use
a higher `versionCode` than the previous release; update `versionCode` and
`versionName` in `app/build.gradle`.

Use the same upload keystore used for the existing Play Store app. Do not
commit the keystore or its passwords:

```bash
cp keystore.properties.example keystore.properties
# Edit keystore.properties with the real values.
mkdir -p keystore
# Copy the original islandhop-upload.jks into keystore/
```

If Google Play App Signing is enabled, this local keystore must be the
registered upload key. Google signs the distributed APKs with the app-signing
key, while Play Console accepts bundles signed with the upload key. If App
Signing is not enabled, use the original release keystore instead. In either
case, a new key will not produce an accepted update unless Google Play approves
the appropriate key change.

## Command line

From `frontend`:

```bash
./build-aab.sh
```

The signed bundle is written to:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

The script builds the web app, synchronizes the built assets with Capacitor,
and runs the Android release bundle task.

## Android Studio

1. Open `frontend/android` in Android Studio and wait for Gradle sync.
2. Confirm `applicationId "com.islandhop.app"` and the release version.
3. Configure `keystore.properties` and the original upload keystore.
4. Select **Build > Generate Signed Bundle / APK**, choose **Android App
   Bundle**, and select the `release` variant.
5. Upload `app-release.aab` from the output path above to Play Console.
