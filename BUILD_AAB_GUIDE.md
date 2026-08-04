# Building AAB (Android App Bundle) for Play Store

This guide explains how to build and upload an AAB file for the Google Play Store.

## Application Details

| Field | Value |
|---|---|
| Package Name | `com.islandhop.app` |
| Current versionCode | `3` |
| Current versionName | `1.2` |
| Keystore file | `islandhop-upload.jks` |
| Key alias | `islandhop` |

## Prerequisites

### 1. Android Keystore File

You need a signed keystore file (`.jks`) for release builds. This file is the permanent signing identity for your app — **never lose it and never commit it to the repository**.

If you don't have one, generate it now:

```bash
keytool -genkey -v \
  -keystore islandhop-upload.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias islandhop
```

When prompted use:
- **Keystore password**: `islandhop2026`
- **Key alias**: `islandhop`
- **Key password**: `islandhop2026`

> **IMPORTANT**: Keep a secure offline backup of `islandhop-upload.jks`. Losing this file means you can never update the app on the Play Store.

### 2. GitHub Secrets Configuration

Add the following five secrets to your repository under `Settings > Secrets and variables > Actions`:

| Secret Name | Value / Description |
|---|---|
| `KEYSTORE_FILE_NAME` | `islandhop-upload.jks` |
| `KEYSTORE_FILE_BASE64` | Base64-encoded content of your keystore file (see below) |
| `KEYSTORE_PASSWORD` | `islandhop2026` |
| `KEY_ALIAS` | `islandhop` |
| `KEY_PASSWORD` | `islandhop2026` |

**How to encode your keystore to base64:**

```bash
# macOS / Linux
base64 -i islandhop-upload.jks | tr -d '\n' > keystore_base64.txt

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("islandhop-upload.jks")) | Out-File keystore_base64.txt
```

Copy the entire content of `keystore_base64.txt` as the value for `KEYSTORE_FILE_BASE64`.

## Using GitHub Actions Workflow (Recommended)

The workflow file is located at `.github/workflows/build-aab.yml`.

### Option 1: Trigger from the Actions Tab

1. Go to the **Actions** tab in your repository
2. Select **"Build AAB Bundle for Play Store"** from the left sidebar
3. Click **"Run workflow"**
4. Optionally enter a custom `version_code` and `version_name`:
   - Leave blank to **auto-increment** the version code from the current value
5. Click **"Run workflow"** to start the build
6. Wait for the build to complete (~5–10 minutes)
7. Download the signed AAB from the **Artifacts** section of the completed run
8. A **GitHub Release** is also created automatically with the AAB attached

### Option 2: Trigger via API

```bash
curl -X POST \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{"ref":"main","inputs":{"version_code":"4","version_name":"1.3"}}' \
  https://api.github.com/repos/fortunestatistics/caribbeandeliveryapp-island-hop/actions/workflows/build-aab.yml/dispatches
```

### What the Workflow Does

1. Checks out the repository
2. Decodes the `KEYSTORE_FILE_BASE64` secret and writes `android/keystore/islandhop-upload.jks`
3. Creates `android/keystore.properties` with signing credentials from secrets
4. Sets up Node.js 20, installs frontend dependencies with yarn
5. Builds the React web assets
6. Sets up JDK 21 and Android SDK (API 35)
7. Syncs the Capacitor Android project
8. Auto-increments (or uses custom) versionCode and versionName in `build.gradle`
9. Runs `./gradlew bundleRelease`
10. Uploads the AAB as a workflow artifact (30-day retention)
11. Creates a GitHub Release with the AAB attached

## Building Locally (Alternative)

### 1. Install Dependencies
```bash
cd frontend
yarn install
```

### 2. Build Web Assets
```bash
yarn build
```

### 3. Sync Capacitor
```bash
npx cap sync android
```

### 4. Place the Keystore File
```bash
mkdir -p frontend/android/keystore
cp /path/to/islandhop-upload.jks frontend/android/keystore/
```

### 5. Create Keystore Properties
Create `frontend/android/keystore.properties`:
```properties
storeFile=../keystore/islandhop-upload.jks
storePassword=<your-keystore-password>
keyAlias=islandhop
keyPassword=<your-key-password>
```

### 6. Build the AAB
```bash
cd frontend/android
chmod +x gradlew
./gradlew bundleRelease
```

The signed AAB is output to:
```
frontend/android/app/build/outputs/bundle/release/app-release.aab
```

## Google Play Console Setup and Upload

### 1. Prepare Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app (or select the existing one)
3. Complete all required sections:
   - App content / privacy policy
   - Content rating questionnaire
   - Target audience
   - Store listing (title, description, screenshots)

### 2. Upload the AAB

1. Navigate to **Release > Production** (or Testing track for initial review)
2. Click **"Create new release"**
3. Upload the `.aab` file
4. Enter release notes in the "What's new" section
5. Click **"Review release"**, then **"Start rollout to Production"**

### 3. Important Play Store Notes

- The **versionCode must increase** for every new release
- The first release is reviewed by Google (typically 24–72 hours)
- Subsequent releases with no content policy changes usually roll out faster
- Always use the **same keystore** for all releases — switching keystores requires creating a new app listing

## Version Management

| Field | Current Value | Notes |
|---|---|---|
| `versionCode` | `3` | Integer; must increment for each Play Store release |
| `versionName` | `1.2` | Human-readable; displayed in Play Store |

The GitHub Actions workflow auto-increments `versionCode` on every build unless you specify a custom value. Update `versionName` manually via the workflow input or in `frontend/android/app/build.gradle`.

## Troubleshooting

### "Release builds require keystore.properties"
- Verify that `keystore.properties` exists in `frontend/android/`
- Confirm the `storeFile` path points to the correct `.jks` location
- Check that all five GitHub Secrets are configured

### AAB Build Fails (Gradle error)
```bash
# Clean stale build artifacts and retry
cd frontend/android
./gradlew clean bundleRelease --info
```

### Base64 Decode Errors
Ensure `KEYSTORE_FILE_BASE64` has no line breaks:
```bash
base64 -i islandhop-upload.jks | tr -d '\n'
```

### Java Version Errors
The project requires **JDK 21**. The workflow installs it automatically. For local builds:
```bash
java -version   # should show openjdk 21
```

### `aapt2` / SDK Not Found
Run the Android SDK manager and ensure `platforms;android-35` and `build-tools;35.0.0` are installed.

## Security Best Practices

⚠️ **NEVER** commit to the repository:
- `keystore.properties` (already in `.gitignore`)
- Keystore files (`*.jks`, `*.keystore`) — already in `.gitignore`
- Raw passwords or credentials

✅ **DO**:
- Store all credentials exclusively in **GitHub Secrets**
- Keep an **offline backup** of the keystore file in a secure location (password manager, encrypted drive)
- **Rotate secrets immediately** if they are accidentally exposed
- Use a dedicated upload key separate from the app signing key (Google Play App Signing manages the signing key for you)
