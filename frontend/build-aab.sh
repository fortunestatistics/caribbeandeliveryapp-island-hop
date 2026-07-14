#!/usr/bin/env bash
#
# IslandHop — build a signed Android App Bundle (.aab) for Google Play.
# Run this on YOUR machine (macOS/Linux/WSL) that has JDK 17 + Android SDK.
# It rebuilds the web app, syncs it into the native project, and produces a
# signed release .aab you can upload in Google Play Console.
#
# Usage:
#   cd frontend
#   ./build-aab.sh
#
set -euo pipefail

# Always run from the frontend/ directory (where this script lives).
cd "$(dirname "$0")"

echo "==> [0/4] Checking prerequisites…"
command -v java >/dev/null 2>&1 || { echo "ERROR: Java (JDK 17) not found. Install Temurin/OpenJDK 17."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js not found."; exit 1; }
if [ ! -f "android/keystore.properties" ]; then
  echo "ERROR: android/keystore.properties is missing."
  echo "       Copy android/keystore.properties.example to android/keystore.properties and fill in your signing values."
  exit 1
fi
if [ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]; then
  echo "WARNING: ANDROID_HOME / ANDROID_SDK_ROOT not set. If gradle fails, open the project once in Android Studio to install the SDK."
fi

echo "==> [1/4] Installing web dependencies…"
yarn install

echo "==> [2/4] Building the production web app…"
GENERATE_SOURCEMAP=false CI=false yarn build

echo "==> [3/4] Syncing the web build into the Android project (Capacitor)…"
npx cap sync android

echo "==> [4/4] Building the signed release AAB…"
cd android
chmod +x gradlew
./gradlew clean bundleRelease

AAB="app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB" ]; then
  echo ""
  echo "✅ SUCCESS. Signed App Bundle created:"
  echo "   frontend/android/$AAB"
  echo ""
  echo "Next: Google Play Console → your app → Production → Create new release → upload this .aab."
  echo "Remember: each release needs a higher versionCode in android/app/build.gradle."
else
  echo "❌ Build finished but the .aab was not found. Check the gradle output above."
  exit 1
fi
