# Building AAB (Android App Bundle) for Play Store

This guide explains how to build and upload an AAB file for the Google Play Store.

## Prerequisites

1. **Android Keystore File**
   - You need a signed keystore file (.jks) for release builds
   - If you don't have one, generate it:
     ```bash
     keytool -genkey -v -keystore islandhop-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias islandhop
     ```
   - **IMPORTANT**: Save this keystore file securely. You'll need it for all future Play Store uploads.

2. **GitHub Secrets Setup**
   Add these secrets to your repository (`Settings > Secrets and variables > Actions`):
   
   - `KEYSTORE_FILE_NAME`: The filename of your keystore (e.g., `islandhop-upload.jks`)
   - `KEYSTORE_FILE_BASE64`: Base64 encoded content of your keystore file
     ```bash
     base64 -i islandhop-upload.jks -o keystore_base64.txt
     # Copy the content of keystore_base64.txt to the secret
     ```
   - `KEYSTORE_PASSWORD`: The password you set for the keystore
   - `KEY_ALIAS`: The key alias (e.g., `islandhop`)
   - `KEY_PASSWORD`: The password for the key alias

## Building Locally (Alternative)

If you prefer to build locally without GitHub Actions:

### 1. Install Dependencies
```bash
cd frontend
yarn install
```

### 2. Build Web Assets
```bash
yarn build
```

### 3. Set Up Keystore Properties
Create `frontend/android/keystore.properties`:
```properties
storeFile=../keystore/islandhop-upload.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=islandhop
keyPassword=YOUR_KEY_PASSWORD
```

### 4. Place Keystore File
```bash
mkdir -p frontend/android/keystore
cp /path/to/islandhop-upload.jks frontend/android/keystore/
```

### 5. Build the AAB
```bash
cd frontend/android
chmod +x gradlew
./gradlew bundleRelease
```

The AAB file will be generated at:
```
frontend/android/app/build/outputs/bundle/release/app-release.aab
```

## Using GitHub Actions Workflow

### Option 1: Automatic Build (Recommended)
1. Set up the required GitHub Secrets (see Prerequisites)
2. Go to `Actions` tab in your repository
3. Select "Build AAB Bundle for Play Store"
4. Click "Run workflow"
5. (Optional) Specify custom version code and version name
6. Wait for the build to complete
7. Download the AAB from the artifacts section

### Option 2: Manual Trigger with Version Info
```bash
curl -X POST \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+raw" \
  -d '{"ref":"main","inputs":{"version_code":"4","version_name":"1.3"}}' \
  https://api.github.com/repos/fortunestatistics/caribbeandeliveryapp-island-hop/actions/workflows/build-aab.yml/dispatches
```

## Uploading to Google Play Store

### 1. Set Up Google Play Console
- Go to [Google Play Console](https://play.google.com/console)
- Create a new app or select existing one
- Complete app information, content rating, and pricing

### 2. Upload AAB
1. Navigate to `Release > Production` (or appropriate track)
2. Click "Create new release"
3. Upload the AAB file
4. Add release notes
5. Review and publish

### 3. Important Notes
- First release must go through review (usually 24-48 hours)
- Update the version code for each release (must be incrementally higher)
- Keep your keystore file safe - it's needed for all future updates

## Troubleshooting

### Build Fails with "Release builds require keystore.properties"
- Ensure keystore.properties is properly configured
- Verify the keystore file path is correct
- Check that all keystore secrets are set in GitHub

### AAB Build Fails
```bash
# Clean build files
cd frontend/android
./gradlew clean

# Try again
./gradlew bundleRelease
```

### View Build Logs Locally
```bash
cd frontend/android
./gradlew bundleRelease --info
```

## Version Management

- **versionCode**: Must increment by 1 for each release (internal use)
- **versionName**: User-visible version (e.g., 1.0, 1.1, 1.2)

Current version:
- versionCode: 3
- versionName: 1.2

Update in `frontend/android/app/build.gradle` as needed.

## Security Best Practices

⚠️ **NEVER** commit:
- `keystore.properties`
- Keystore files (.jks)
- Private keys or passwords

✅ **DO**:
- Store credentials in GitHub Secrets
- Use environment variables for sensitive data
- Keep keystore file backed up securely
- Rotate credentials if compromised
