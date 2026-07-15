#!/usr/bin/env bash

set -euo pipefail

frontend_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
android_dir="$frontend_dir/android"

if [[ ! -f "$android_dir/keystore.properties" ]]; then
  printf 'Missing %s. Copy keystore.properties.example and configure the original Play upload key.\n' \
    "$android_dir/keystore.properties" >&2
  exit 1
fi

if [[ ! -d "$android_dir/keystore" ]]; then
  printf 'Missing %s. Add the original Play upload keystore before building.\n' \
    "$android_dir/keystore" >&2
  exit 1
fi

cd "$frontend_dir"
yarn install --frozen-lockfile
yarn build
npx cap sync android

cd "$android_dir"
./gradlew bundleRelease

printf 'AAB created at %s\n' \
  "$android_dir/app/build/outputs/bundle/release/app-release.aab"
