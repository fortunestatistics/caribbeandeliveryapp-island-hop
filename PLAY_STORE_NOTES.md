# IslandHop — Google Play Store Submission Notes

## Business / Identity
- **D-U-N-S Number:** 145048519
- **Developer / Company:** IslandHop Technologies (Trinidad & Tobago)
- **Support contact:** support@islandhoptt.com

## App Identifiers
- **App ID (applicationId):** `com.islandhop.app`
- **Package name:** `com.islandhop.app`
- **App name:** IslandHop
- **versionCode:** 1
- **versionName:** 1.0

## Mobile stack
- **Capacitor:** v7 (Node 20 compatible; v8 requires Node 22)
- **webDir:** `build` (CRA/craco production build)
- Native Android project: `/app/frontend/android/`

## Android permissions (AndroidManifest.xml)
- INTERNET, ACCESS_NETWORK_STATE
- ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION (live driver tracking & delivery addresses)
- POST_NOTIFICATIONS (order/delivery alerts)
- RECEIVE_BOOT_COMPLETED, FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION (active-trip tracking)
- VIBRATE
- Network Security Config: `res/xml/network_security_config.xml` (HTTPS-only, no cleartext)

## Build commands (run on a machine with Android Studio / Android SDK + JDK 17)
```bash
cd /app/frontend
yarn build
npx cap sync android
cd android && chmod +x gradlew
./gradlew assembleDebug      # -> app/build/outputs/apk/debug/app-debug.apk  (testing)
./gradlew bundleRelease      # -> app/build/outputs/bundle/release/app-release.aab  (Play upload, must be signed)
```

## Release signing (for the .aab upload)
1. Create a keystore: `keytool -genkey -v -keystore islandhop.keystore -alias islandhop -keyalg RSA -keysize 2048 -validity 10000`
2. Provide signing values via env vars (`ISLANDHOP_STORE_FILE`, `ISLANDHOP_STORE_PASSWORD`, `ISLANDHOP_KEY_ALIAS`, `ISLANDHOP_KEY_PASSWORD`), Gradle properties of the same names, or `android/keystore.properties` (see `keystore.properties.example`). `bundleRelease` fails if any are missing; it never uses the debug key.
3. Build `bundleRelease`, then upload the signed `.aab` in Google Play Console (enroll in Play App Signing).

## Play Console required links
- Privacy Policy: https://islandhopapp.com/privacy-policy
- Terms of Service: https://islandhopapp.com/terms
