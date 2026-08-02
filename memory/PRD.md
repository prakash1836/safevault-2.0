# SafeVault - PRD

## Original Problem Statement (2026-01)
Convert the existing SafeVault Expo application into a fully working Android
Development Build (Expo Dev Client) while preserving 100% of the existing
functionality, architecture, UI, business logic, Google Drive integration,
encryption, SQLite, metadata management, upload coordinator, sync
architecture, reminders, notifications, and navigation.

Goal: install a Development APK on an Android device and connect it to the
laptop with `npx expo start --dev-client --clear`, with Live Reload, Fast
Refresh, native module debugging, JS error overlay, console logs and React
Native debugging fully functional.

## Analysis Result
The project (Expo SDK 54, RN 0.81.5) already had every piece of software
configuration needed to run as a Dev Client:

- `expo-dev-client@~6.0.21` present in `frontend/package.json`.
- `frontend/android/app/src/debug/AndroidManifest.xml` enables
  `usesCleartextTraffic="true"` (required to talk to Metro over HTTP).
- `frontend/android/app/src/main/AndroidManifest.xml` declares the
  intent-filters for `safevault://` and `exp+safevault://` schemes, which
  the Expo Dev Client uses for deep-link launch and QR-code redirect.
- `MainApplication.kt` uses `ReactNativeHostWrapper`, sets
  `getJSMainModuleName = ".expo/.virtual-metro-entry"` and enables
  developer support in DEBUG builds.
- `MainActivity.kt` uses `ReactActivityDelegateWrapper`.
- `gradle.properties` sets `EX_DEV_CLIENT_NETWORK_INSPECTOR=true`,
  `hermesEnabled=true` and `newArchEnabled=true`.
- `frontend/android/app/debug.keystore` is committed - so debug builds
  are already signable in CI without any secrets.
- The React Native Gradle plugin's default `debuggableVariants=["debug"]`
  guarantees that `assembleDebug` does **not** embed a JS bundle and the
  APK will fetch JS live from Metro at runtime.

Conclusion: zero application source-code changes were required - the
project was already Dev-Client-ready. Only a CI workflow was missing.

## Files Added / Changed
| File | Type | Reason |
|------|------|--------|
| `.github/workflows/android-debug.yml` | NEW | Generates the Development APK on GitHub Actions using `./gradlew assembleDebug`. Uploads it as a downloadable artifact suitable for `adb install`. |

Explicitly unchanged:
- `.github/workflows/android.yml` (Release build - untouched, verified via `git diff`).
- Any application source, native `android/` folder, `app.json`, `eas.json`,
  `package.json`, `MainActivity.kt`, `MainApplication.kt`, AndroidManifests.
- Business logic, UI, auth, Google Drive, encryption, SQLite, metadata,
  upload coordinator, sync, reminders, notifications, navigation.

## How to Use the New Workflow

### CI (recommended)
1. Push/merge to `beforeappdevelopment`, or trigger the workflow manually
   from GitHub UI: Actions -> "Android Development Build (Dev Client)" ->
   "Run workflow".
2. Download the artifact `SafeVault-DevClient-Debug-APK`.
3. Install on the phone: `adb install -r SafeVault-dev-client-debug.apk`.
4. On the laptop:
   ```bash
   cd frontend
   yarn install
   npx expo start --dev-client --clear
   ```
5. Ensure phone + laptop are on the same Wi-Fi. Open SafeVault on the
   phone - the Expo Dev Launcher appears. Scan the Metro QR code or tap
   the auto-discovered server entry. Live Reload / Fast Refresh /
   JS error overlay / console logs / native-module debugging all work.

### Local (alternative)
```bash
cd frontend
yarn install
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
cd ..
npx expo start --dev-client --clear
```

## Backlog / Next Actions
- P1: Add matching `ios-debug.yml` for iOS Simulator Dev Client (mac runner).
- P2: Add an internal-distribution workflow to publish debug builds to
  Firebase App Distribution automatically.
- P2: Add `workflow_dispatch` inputs to select branch / build variant.
