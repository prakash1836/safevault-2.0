# Google OAuth Setup — Step by Step

This app uses the user's own Google Drive (`drive.file` scope). Only files created
by this app are visible to it; private user files stay private.

## 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. Create a new project (e.g. `SafeVault`).
3. In the left menu → **APIs & Services → Library** → search for **Google Drive API** → **Enable**.

## 2. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **External** → **Create**.
3. Fill app name, support email, developer email.
4. **Scopes** → Add → select `https://www.googleapis.com/auth/drive.file`.
5. **Test users** → add your own Google email (while the app is in Testing mode).

## 3. Create OAuth client IDs

Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
Create ONE client per platform you need:

### Web (required for Expo web + Expo Go dev)
- Application type: **Web application**
- Authorized JavaScript origins:
  - `http://localhost:8081`
  - `http://localhost:19006`
  - `https://auth.expo.io`
  - Your deployed web URL if any
- Authorized redirect URIs:
  - `http://localhost:8081`
  - `https://auth.expo.io/@<your-expo-username>/frontend`
  - Your deployed web URL if any
- Save → copy the **Client ID** into `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB`.

### iOS (required for a real iOS build)
- Application type: **iOS**
- Bundle ID: value of `ios.bundleIdentifier` in `app.json`
- Copy the Client ID into `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS`.

### Android (required for a real Android build)
- Application type: **Android**
- Package name: value of `android.package` in `app.json`
- SHA-1: from your signing certificate (`eas credentials` or keystore).
- Copy the Client ID into `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID`.

## 4. Paste IDs into `.env`

```
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=xxxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=xxxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=xxxxx.apps.googleusercontent.com
```

Restart the Expo dev server after editing `.env`.

## 5. Scopes used by this app

- `https://www.googleapis.com/auth/drive.file` — read/write **only files created by this app**
- `openid`, `email`, `profile` — to show user name/avatar

No other scope is requested.
