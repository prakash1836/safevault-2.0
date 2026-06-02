# SafeVault 2.0 — Build Guide

> Complete guide to building SafeVault for development, staging, and production releases.

## Prerequisites

```bash
# Node 18+
node --version

# Yarn (preferred over npm — used by Expo)
npm install -g yarn

# EAS CLI for Android/iOS builds
npm install -g eas-cli

# Optional: Watchman (for stable file watching in dev)
# macOS: brew install watchman
# Debian/Ubuntu: sudo apt-get install watchman
```

## 1. Local Development

```bash
cd /app/frontend
yarn install
yarn start
```

Then either:
- Press `a` to open Android emulator
- Press `w` to open web browser
- Scan QR with Expo Go app for real-device testing

## 2. Environment Variables

Edit `/app/frontend/.env`:

```bash
# Required for Google OAuth (web, dev)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<your-web-client-id>.apps.googleusercontent.com

# Required for Android production builds
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<your-android-client-id>.apps.googleusercontent.com

# Optional iOS (future)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<your-ios-client-id>.apps.googleusercontent.com
```

⚠️ Never commit `.env` to git.

## 3. Preview APK Build (for sideloading)

```bash
cd /app/frontend
eas login
eas build:configure   # First time only
eas build --platform android --profile preview
```

The `preview` profile produces an installable `.apk` file.

After build completes:
1. Download the APK from the EAS dashboard URL printed to console
2. Transfer to Android device (USB or email)
3. Enable "Install from unknown sources" on device
4. Install + test

## 4. Production AAB Build (for Play Store)

```bash
eas build --platform android --profile production
```

This produces an `.aab` (Android App Bundle) optimized for Play Store delivery.

## 5. Submit to Play Store

```bash
# One-time: configure service account in eas.json
eas submit --platform android --latest
```

## 6. EAS.json Reference

If `eas.json` doesn't exist yet, `eas build:configure` will create it. Recommended structure:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "channel": "preview"
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./service-account-key.json",
        "track": "internal"
      }
    }
  }
}
```

## 7. Version Bumping

Every build must have a unique versionCode for Play Store:

In `app.json`:
```json
{
  "expo": {
    "version": "1.0.1",         // human-readable
    "runtimeVersion": "1.0.0",  // OTA compatibility group
    "android": {
      "versionCode": 2          // must increment monotonically
    },
    "ios": {
      "buildNumber": "2"
    }
  }
}
```

## 8. Common Issues

### "File watchers limit reached" in dev
Install Watchman: `sudo apt-get install watchman` (Linux) or `brew install watchman` (macOS).

### Bundle errors on web
Some native-only modules (biometric, file picker) are no-op on web by design. This is expected.

### OAuth doesn't work in APK
See `GOOGLE_OAUTH_SETUP.md` — you must register your APK's SHA-1 fingerprint with Google Cloud Console.

### Notifications don't fire on real device
- Verify POST_NOTIFICATIONS permission in app.json
- Try `Profile → Reminders → Send Test` button (fires in 5s)
- Check Android system Settings → Apps → SafeVault → Notifications

## 9. Performance Targets

| Metric | Target | How to measure |
|--------|--------|----------------|
| Cold start | < 2.5s | Stopwatch from launch to home |
| Bundle size (APK) | < 30 MB | EAS dashboard or `aapt dump` |
| TTI (Time to interactive) | < 3s | React DevTools profiler |
| FPS (scroll) | 60 FPS | Android Profiler or Flipper |
| Memory | < 200 MB | Android Studio profiler |
