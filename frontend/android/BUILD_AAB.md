<<<<<<< HEAD
# IslandHop — Build & Publish the Play Store Update (.aab)

This guide takes the app you built in Emergent and turns it into a signed
**Android App Bundle (`.aab`)** you upload to your **live** Play Store listing
(`com.islandhop.app`). Your app **bundles the web build inside the APK**, so a
new signed release is required for the new features to reach users.

---

## 0. One-time prerequisites (on your computer)
Install these on the machine that will build the app (macOS / Windows / Linux):

1. **Android Studio** (latest) → https://developer.android.com/studio
   - On first launch it installs the **Android SDK** + build tools automatically.
2. **JDK 17** (Temurin/OpenJDK 17). Android Studio bundles a JDK; if building
   from the terminal, ensure `java -version` shows 17.
3. **Node.js 20** + **Yarn** (`npm i -g yarn`) — to build the web app.

---

## 1. Get the latest code from Emergent
In Emergent, click **“Save to GitHub”**, then on your computer:
```bash
git clone <your-repo-url>        # first time
# or
git pull                          # if already cloned
```

## 2. Add your signing secrets (kept out of git)
Your signing passwords now live in a **git-ignored** file. Create it once:
```bash
cd frontend/android
cp keystore.properties.example keystore.properties
# then edit keystore.properties and fill in the real values:
#   storeFile=../keystore/islandhop-upload.jks
#   storePassword=********
#   keyAlias=islandhop
#   keyPassword=********
```
> Make sure the keystore file `frontend/android/keystore/islandhop-upload.jks`
> is present. **Keep a backup of it somewhere safe** — losing it means you can
> never update this app again (unless you use Play App Signing).

## 3. Bump the version for every new release
Google Play rejects a release if `versionCode` isn’t higher than what’s live.
Edit `frontend/android/app/build.gradle`:
```gradle
versionCode 2        // increment by 1 every release (3, 4, 5, …)
versionName "1.1"    // human-readable, e.g. "1.1", "1.2"
```
(It’s already set to `versionCode 2 / versionName 1.1` for this update.)

---

## 4A. Build the .aab — the easy way (script)
From the `frontend/` folder:
```bash
./build-aab.sh
```
This runs `yarn build` → `npx cap sync android` → `./gradlew clean bundleRelease`
and prints the path to the signed bundle:
```
frontend/android/app/build/outputs/bundle/release/app-release.aab
```

## 4B. Build the .aab — from the terminal (manual)
```bash
cd frontend
yarn install
yarn build
npx cap sync android
cd android
chmod +x gradlew          # macOS/Linux only
./gradlew clean bundleRelease
```
Windows (PowerShell): use `gradlew.bat clean bundleRelease`.

## 4C. Build the .aab — in Android Studio (GUI)
1. `cd frontend && yarn build && npx cap sync android`
2. `npx cap open android` (opens the project in Android Studio).
3. Wait for Gradle sync to finish.
4. Menu **Build → Generate Signed Bundle / APK… → Android App Bundle**.
5. Choose your keystore (`islandhop-upload.jks`), enter the passwords, alias.
6. Select **release** build variant → **Finish**.
7. The `.aab` is written to `app/build/outputs/bundle/release/`.

---

## 5. Upload to Google Play
1. Go to **Google Play Console** → your app (**IslandHop**).
2. **Production** (or **Testing → Internal testing** first) → **Create new release**.
3. Upload `app-release.aab`.
4. Fill in **Release notes** (what changed — Settings pages, business-type-aware
   menus/catalog, pharmacy Rx storefront, wallet, fee-savings, etc.).
5. **Review release → Start rollout to Production**.
6. Google review can take a few hours to a couple of days.

---

## Troubleshooting
- **`SDK location not found`** → open the project once in Android Studio, or create
  `frontend/android/local.properties` with `sdk.dir=/absolute/path/to/Android/sdk`.
- **`keystore.properties missing`** → do step 2. Without it, the release build falls
  back to debug signing and Play will reject it.
- **`versionCode X has already been used`** → increment `versionCode` (step 3).
- **`Gradle/JDK` errors** → confirm JDK 17 (`java -version`) and let Android Studio
  install the matching Gradle when prompted.

## Recommended next step: Play App Signing
Because your signing passwords were previously committed to git, enroll in
**Play App Signing** (Play Console → Setup → App integrity) and rotate to a fresh
**upload key**. Google then holds the real signing key; you only keep an upload key,
so a leak is far less damaging.
=======
# Build the IslandHop Google Play bundle

The Android project is in this directory. Open `frontend/android` in Android
Studio, not the repository root.

## Before building

The application ID must remain `com.islandhop.app` so this bundle updates the
existing Play Store listing rather than creating a new app. Each Play release
must use a higher `versionCode` than the previous release; update
`versionCode` and `versionName` in `app/build.gradle`.

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
>>>>>>> cb805eb
